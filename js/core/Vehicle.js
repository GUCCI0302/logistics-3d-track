import * as THREE from 'three';
import { CONFIG, STATUS, VEHICLE_TYPES } from '../config/constants.js';
import { CoordinateConverter } from '../utils/coordinate.js';
import { AnimationUtils } from '../utils/animation.js';

/**
 * 车辆类
 * 管理3D车辆模型、移动逻辑和状态
 */
export class Vehicle {
  constructor(id, cityName, scene, options = {}) {
    this.id = id;
    this.scene = scene;
    this.type = options.type || 'TRUCK';
    this.config = VEHICLE_TYPES[this.type];
    
    this.status = STATUS.IDLE;
    this.currentCity = cityName;
    this.targetCity = null;
    this.path = [];
    this.pathIndex = 0;
    
    this.speed = options.speed || CONFIG.VEHICLE.DEFAULT_SPEED;
    this.currentSpeed = 0;
    this.maxSpeed = CONFIG.VEHICLE.MAX_SPEED;
    
    this.mesh = null;
    this.wheels = [];
    this.label = null;
    this.labelUpdateFn = null;
    
    this.onStatusChange = null;
    this.onPositionUpdate = null;
    this.onArrive = null;
    
    // 存储 setTimeout ID，用于清除
    this.idleTimeoutId = null;
    
    this._createModel();
    this._createLabel();
    
    // 将车辆添加到场景
    if (this.scene && this.mesh) {
      this.scene.add(this.mesh);
      console.log('车辆已添加到场景');
    } else {
      console.warn('无法添加车辆到场景，scene或mesh为空:', { scene: !!this.scene, mesh: !!this.mesh });
    }
  }

  /**
   * 创建车辆3D模型
   */
  _createModel() {
    this.mesh = new THREE.Group();
    
    const [width, height, length] = this.config.size;
    
    // 车身
    const bodyGeo = new THREE.BoxGeometry(width, height, length);
    const bodyMat = new THREE.MeshLambertMaterial({ color: this.config.color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = height / 2;
    body.castShadow = true;
    this.mesh.add(body);
    
    // 驾驶室
    const cabGeo = new THREE.BoxGeometry(width * 0.8, height * 0.6, length * 0.3);
    const cabMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.set(0, height + height * 0.3, length * 0.35);
    cab.castShadow = true;
    this.mesh.add(cab);
    
    // 车轮
    const wheelRadius = 0.3;
    const wheelWidth = 0.3;
    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    
    const wheelPositions = [
      [-width / 2 - 0.1, wheelRadius, length * 0.3],   // 前左
      [width / 2 + 0.1, wheelRadius, length * 0.3],    // 前右
      [-width / 2 - 0.1, wheelRadius, -length * 0.3],  // 后左
      [width / 2 + 0.1, wheelRadius, -length * 0.3]    // 后右
    ];
    
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(...pos);
      wheel.castShadow = true;
      this.mesh.add(wheel);
      this.wheels.push(wheel);
    });
    
    // 车灯
    const lightGeo = new THREE.BoxGeometry(0.2, 0.1, 0.05);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const leftLight = new THREE.Mesh(lightGeo, lightMat);
    leftLight.position.set(-width * 0.3, height * 0.7, length / 2 + 0.02);
    this.mesh.add(leftLight);
    
    const rightLight = new THREE.Mesh(lightGeo, lightMat);
    rightLight.position.set(width * 0.3, height * 0.7, length / 2 + 0.02);
    this.mesh.add(rightLight);
    
    this.scene.add(this.mesh);
  }

  /**
   * 创建车辆标签
   */
  _createLabel() {
    this.label = document.createElement('div');
    this.label.className = 'vehicle-label';
    this.label.innerHTML = `
      <div class="label-name">车辆 ${this.id}</div>
      <div class="label-status">${this.status}</div>
    `;
    // 将标签添加到3D场景容器内
    const container = document.getElementById('scene3d');
    if (container) {
      container.appendChild(this.label);
    } else {
      document.body.appendChild(this.label);
    }
    
    this.labelUpdateFn = () => {
      if (!this.mesh) return;
      
      const container = document.getElementById('scene3d');
      if (!container) return;
      
      const pos = this.mesh.position.clone();
      pos.y += 2;
      pos.project(window.app.scene3d.camera);
      
      // 计算相对于3D容器的位置
      const x = (pos.x * 0.5 + 0.5) * container.clientWidth;
      const y = (-(pos.y * 0.5 - 0.5) * container.clientHeight);
      
      this.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      this.label.style.display = pos.z < 1 ? 'block' : 'none';
    };
  }

  /**
   * 移动到目标城市
   * @param {string} cityName - 目标城市名
   * @param {THREE.Vector3} targetPos - 目标位置
   */
  moveTo(cityName, targetPos) {
    if (this.status === STATUS.MOVING) return;
    
    // 清除之前的 setTimeout
    if (this.idleTimeoutId) {
      clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }
    
    this.targetCity = cityName;
    this.targetPos = targetPos.clone();
    this.status = STATUS.MOVING;
    this.currentSpeed = this.speed;
    
    // 计算朝向
    const direction = this.targetPos.clone().sub(this.mesh.position).normalize();
    const angle = Math.atan2(direction.x, direction.z);
    this.mesh.rotation.y = angle;
    
    this._updateLabel();
    
    if (this.onStatusChange) {
      this.onStatusChange(this.status);
    }
  }

  /**
   * 更新车辆状态
   * @param {number} deltaTime - 时间差
   */
  update(deltaTime) {
    if (this.status !== STATUS.MOVING || !this.targetPos) {
      return;
    }

    // 旋转车轮
    this.wheels.forEach(wheel => {
      wheel.rotation.x += CONFIG.VEHICLE.WHEEL_ROTATION_SPEED;
    });

    // 移动
    const distance = this.mesh.position.distanceTo(this.targetPos);

    // 限制最大移动距离，防止跳过头
    const maxMoveDistance = this.currentSpeed * Math.min(deltaTime, 50) * 0.1;
    const moveDistance = Math.min(maxMoveDistance, distance);

    if (distance > 0.005) {
      // 平滑移动
      const direction = this.targetPos.clone().sub(this.mesh.position).normalize();
      this.mesh.position.add(direction.multiplyScalar(moveDistance));

      if (this.onPositionUpdate) {
        this.onPositionUpdate(this.mesh.position.clone());
      }
    } else {
      // 到达目标
      this.mesh.position.copy(this.targetPos);
      this.currentCity = this.targetCity;
      this.status = STATUS.ARRIVED;
      this.currentSpeed = 0;

      this._updateLabel();

      if (this.onStatusChange) {
        this.onStatusChange(this.status);
      }

      if (this.onArrive) {
        this.onArrive(this.currentCity);
      }

      // 2秒后变为空闲状态
      this.idleTimeoutId = setTimeout(() => {
        this.status = STATUS.IDLE;
        this.idleTimeoutId = null;
        this._updateLabel();
        if (this.onStatusChange) {
          this.onStatusChange(this.status);
        }
      }, 2000);
    }
  }

  /**
   * 更新标签显示
   */
  _updateLabel() {
    if (!this.label) return;
    const statusText = {
      [STATUS.IDLE]: '空闲',
      [STATUS.MOVING]: '行驶中',
      [STATUS.ARRIVED]: '已到达',
      [STATUS.LOADING]: '装货中',
      [STATUS.UNLOADING]: '卸货中'
    };
    this.label.querySelector('.label-status').textContent = statusText[this.status] || this.status;
  }

  /**
   * 设置车辆位置
   * @param {THREE.Vector3} position 
   */
  setPosition(position) {
    if (this.mesh) {
      this.mesh.position.copy(position);
    }
  }

  /**
   * 获取车辆位置
   * @returns {THREE.Vector3}
   */
  getPosition() {
    return this.mesh ? this.mesh.position.clone() : new THREE.Vector3();
  }

  /**
   * 销毁车辆
   */
  dispose() {
    if (this.label) {
      this.label.remove();
      this.label = null;
    }
    
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.mesh = null;
    }
  }
}
