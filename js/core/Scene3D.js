import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG, CITIES } from '../config/constants.js';
import { coordinateConverter } from '../utils/coordinate.js';
import { AnimationUtils, FPSCounter } from '../utils/animation.js';

/**
 * 3D场景管理类
 */
export class Scene3D {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animationLoop = null;
    this.fpsCounter = new FPSCounter();
    
    this.cityMeshes = new Map();
    this.cityLabels = new Map();
    this.labelUpdateFns = [];
    
    this.vehicles = new Map();
    
    this.onCityClick = null;
    this.onFPSUpdate = null;
    
    this._init();
  }

  /**
   * 初始化3D场景
   */
  _init() {
    console.log('Scene3D._init 开始...');
    console.log('容器:', this.container);
    
    // 场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);
    this.scene.fog = new THREE.Fog(0x111111, 20, 100);
    console.log('场景创建完成');
    
    // 相机
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    const aspect = width / height;
    
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.SCENE3D.CAMERA_FOV,
      aspect,
      CONFIG.SCENE3D.CAMERA_NEAR,
      CONFIG.SCENE3D.CAMERA_FAR
    );
    this.camera.position.set(...CONFIG.SCENE3D.CAMERA_POSITION);
    this.camera.lookAt(0, 0, 0);
    console.log('相机创建完成');
    
    // 渲染器
    console.log('创建渲染器...');
    console.log('容器尺寸:', this.container.clientWidth, 'x', this.container.clientHeight);
    
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: CONFIG.RENDER.ENABLE_ANTIALIAS 
    });
    
    // 使用之前定义的 width 和 height
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = CONFIG.RENDER.ENABLE_SHADOWS;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    console.log('渲染器创建完成');
    
    // 控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 100;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
    
    // 光照
    this._setupLights();
    
    // 环境
    this._setupEnvironment();
    
    // 城市标记
    this._createCityMarkers();
    
    // 事件监听
    this._setupEventListeners();
    
    // 开始渲染循环
    this._startRenderLoop();
    console.log('Scene3D._init 完成');
  }

  /**
   * 设置光照
   */
  _setupLights() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    // 方向光（太阳光）
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 50, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    this.scene.add(dirLight);
    
    // 补光
    const fillLight = new THREE.DirectionalLight(0x6666ff, 0.3);
    fillLight.position.set(-30, 20, -30);
    this.scene.add(fillLight);
  }

  /**
   * 设置环境
   */
  _setupEnvironment() {
    // 网格地面
    const gridHelper = new THREE.GridHelper(
      CONFIG.SCENE3D.GRID_SIZE,
      CONFIG.SCENE3D.GRID_DIVISIONS,
      0x444444,
      0x222222
    );
    this.scene.add(gridHelper);
    
    // 地面
    const planeGeo = new THREE.PlaneGeometry(200, 200);
    const planeMat = new THREE.MeshLambertMaterial({ 
      color: 0x1a1a1a,
      transparent: true,
      opacity: 0.8
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.01;
    plane.receiveShadow = true;
    this.scene.add(plane);
    
    // 坐标轴
    const axesHelper = new THREE.AxesHelper(10);
    this.scene.add(axesHelper);
  }

  /**
   * 创建城市标记
   */
  _createCityMarkers() {
    const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const sphereMat = new THREE.MeshLambertMaterial({ color: 0xff4500 });
    
    const pulseGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const pulseMat = new THREE.MeshBasicMaterial({ 
      color: 0xff4500, 
      transparent: true, 
      opacity: 0.5 
    });
    
    Object.entries(CITIES).forEach(([name, data]) => {
      const pos = coordinateConverter.lngLatTo3D(...data.center);
      
      // 城市球体
      const mesh = new THREE.Mesh(sphereGeo, sphereMat);
      mesh.position.copy(pos);
      mesh.castShadow = true;
      mesh.userData = { cityName: name, isCity: true };
      this.scene.add(mesh);
      this.cityMeshes.set(name, mesh);
      
      // 脉冲效果
      const pulse = new THREE.Mesh(pulseGeo, pulseMat);
      pulse.position.copy(pos);
      pulse.userData = { isPulse: true, baseScale: 1 };
      this.scene.add(pulse);
      
      // 创建标签
      this._createCityLabel(name, pos);
    });
  }

  /**
   * 创建城市标签
   */
  _createCityLabel(cityName, position) {
    const label = document.createElement('div');
    label.className = 'city-label';
    label.textContent = cityName;
    label.style.position = 'absolute';
    label.style.left = '0';
    label.style.top = '0';
    // 将标签添加到3D场景容器内，而不是body
    this.container.appendChild(label);
    
    this.cityLabels.set(cityName, label);
    
    const updateFn = () => {
      const pos = position.clone();
      pos.y += 1.5; // 标签位置提高
      pos.project(this.camera);
      
      // 检查坐标是否在视野内
      if (pos.z > 1) {
        label.style.display = 'none';
        return;
      }
      
      // 计算相对于3D容器的位置
      const x = (pos.x * 0.5 + 0.5) * this.container.clientWidth;
      const y = (-(pos.y * 0.5 - 0.5) * this.container.clientHeight);
      
      label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      label.style.display = 'block';
    };
    
    this.labelUpdateFns.push(updateFn);
    
    // 立即执行一次更新
    updateFn();
  }

  /**
   * 设置事件监听
   */
  _setupEventListeners() {
    // 窗口大小变化
    window.addEventListener('resize', () => {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });
    
    // 点击事件
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    this.renderer.domElement.addEventListener('click', (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, this.camera);
      
      const cityMeshes = Array.from(this.cityMeshes.values());
      const intersects = raycaster.intersectObjects(cityMeshes);
      
      if (intersects.length > 0) {
        const cityName = intersects[0].object.userData.cityName;
        if (this.onCityClick) {
          this.onCityClick(cityName);
        }
      }
    });
  }

  /**
   * 开始渲染循环
   */
  _startRenderLoop() {
    this.animationLoop = AnimationUtils.createAnimationLoop((deltaTime) => {
      this._update(deltaTime);
    }, CONFIG.RENDER.TARGET_FPS);
    
    this.animationLoop.start();
  }

  /**
   * 更新场景
   */
  _update(deltaTime) {
    // 检查动画循环状态
    if (!this.animationLoop || !this.animationLoop.isRunning) {
      console.warn('动画循环已停止，重新启动');
      this._startRenderLoop();
      return;
    }
    
    try {
      // 更新控制器
      this.controls.update();
      
      // 更新FPS
      const fps = this.fpsCounter.update();
      if (fps > 0 && this.onFPSUpdate) {
        this.onFPSUpdate(fps);
      }
      
      // 更新城市标签
      this.labelUpdateFns.forEach(fn => fn());
      
      // 更新脉冲动画
      this.scene.children.forEach(child => {
        if (child.userData.isPulse) {
          const time = Date.now() * 0.002;
          const scale = 1 + Math.sin(time) * 0.3;
          child.scale.setScalar(scale);
          child.material.opacity = 0.5 - (scale - 1) * 0.5;
        }
      });
      
      // 更新车辆
      this.vehicles.forEach(vehicle => {
        try {
          vehicle.update(deltaTime);
          if (vehicle.labelUpdateFn) {
            vehicle.labelUpdateFn();
          }
        } catch (e) {
          console.error('车辆更新错误:', e);
        }
      });
      
      // 渲染
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      console.error('Scene3D._update 错误:', error);
    }
  }

  /**
   * 添加车辆
   */
  addVehicle(vehicle) {
    this.vehicles.set(vehicle.id, vehicle);
    console.log('Scene3D.addVehicle 被调用');
    console.log('车辆数量:', this.vehicles.size);
    console.log('场景中的对象数量:', this.scene.children.length);
    
    // 检查车辆是否已经在场景中
    if (vehicle.mesh && !this.scene.children.includes(vehicle.mesh)) {
      console.log('将车辆添加到场景');
      this.scene.add(vehicle.mesh);
    }
  }

  /**
   * 移除车辆
   */
  removeVehicle(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    if (vehicle) {
      vehicle.dispose();
      this.vehicles.delete(vehicleId);
    }
  }

  /**
   * 获取城市位置
   */
  getCityPosition(cityName) {
    const city = CITIES[cityName];
    if (city) {
      return coordinateConverter.lngLatTo3D(...city.center);
    }
    return null;
  }

  /**
   * 设置相机目标
   */
  setCameraTarget(target) {
    this.controls.target.copy(target);
    this.controls.update();
  }

  /**
   * 高亮城市
   */
  highlightCity(cityName) {
    const mesh = this.cityMeshes.get(cityName);
    if (mesh) {
      mesh.material.emissive = new THREE.Color(0xff0000);
      mesh.material.emissiveIntensity = 0.5;
      
      setTimeout(() => {
        mesh.material.emissive = new THREE.Color(0x000000);
        mesh.material.emissiveIntensity = 0;
      }, 1000);
    }
  }

  /**
   * 销毁场景
   */
  dispose() {
    if (this.animationLoop) {
      this.animationLoop.stop();
    }
    
    // 清理车辆
    this.vehicles.forEach(vehicle => vehicle.dispose());
    this.vehicles.clear();
    
    // 清理标签
    this.cityLabels.forEach(label => label.remove());
    this.cityLabels.clear();
    
    // 清理场景
    this.scene.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
