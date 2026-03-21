import * as THREE from 'three';
import { AnimationUtils } from '../utils/animation.js';
import { CoordinateConverter } from '../utils/coordinate.js';

/**
 * 轨迹回放管理类
 * 支持记录多次往返轨迹并回放
 */
export class TrajectoryPlayer {
  constructor(scene3d, map2d) {
    this.scene3d = scene3d;
    this.map2d = map2d;
    
    // 所有历史轨迹段
    this.trajectorySegments = [];
    // 当前播放的轨迹数据
    this.trajectoryData = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.playbackSpeed = 1;
    this.currentTime = 0;
    
    this.vehicle = null;
    // 所有轨迹线
    this.pathLines = [];
    this.pathPoints = [];
    
    this.onPlay = null;
    this.onPause = null;
    this.onProgress = null;
    this.onComplete = null;
    
    this.animationId = null;
  }

  /**
   * 添加一段轨迹（记录一次城市间移动）
   * @param {string} fromCity - 起始城市
   * @param {string} toCity - 目标城市
   */
  addSegment(fromCity, toCity) {
    const startPos = this.scene3d.getCityPosition(fromCity);
    const endPos = this.scene3d.getCityPosition(toCity);
    
    if (!startPos || !endPos) {
      console.error('城市位置不存在:', fromCity, '->', toCity);
      return this;
    }
    
    // 创建直线路径点
    const segmentData = [];
    const pointCount = 50;
    
    for (let i = 0; i < pointCount; i++) {
      const t = i / (pointCount - 1);
      const pos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      
      segmentData.push({
        time: i * 100,
        position: pos,
        fromCity: fromCity,
        toCity: toCity
      });
    }
    
    // 保存轨迹段
    this.trajectorySegments.push({
      fromCity,
      toCity,
      data: segmentData
    });
    
    // 创建并显示这段轨迹线
    this._createSegmentLine(startPos, endPos, fromCity, toCity);
    
    console.log(`添加轨迹段: ${fromCity} -> ${toCity}, 当前共 ${this.trajectorySegments.length} 段轨迹`);
    return this;
  }

  /**
   * 创建轨迹线段
   */
  _createSegmentLine(startPos, endPos, fromCity, toCity) {
    const points = [startPos, endPos];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // 根据轨迹段数选择不同颜色
    const colors = [0x00ff88, 0x0088ff, 0xff8800, 0xff0088, 0x88ff00, 0x8800ff];
    const color = colors[this.trajectorySegments.length % colors.length];
    
    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 3,
      transparent: true,
      opacity: 0.8
    });
    
    const line = new THREE.Line(geometry, material);
    this.scene3d.scene.add(line);
    this.pathLines.push(line);
    
    // 添加起点和终点标记
    this._createEndpointMarkers(startPos, endPos, fromCity, toCity, color);
  }

  /**
   * 创建端点标记
   */
  _createEndpointMarkers(startPos, endPos, fromCity, toCity, color) {
    const sphereGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: color });
    
    // 起点标记
    const startMarker = new THREE.Mesh(sphereGeo, sphereMat);
    startMarker.position.copy(startPos);
    startMarker.position.y += 0.5;
    this.scene3d.scene.add(startMarker);
    this.pathPoints.push(startMarker);
    
    // 终点标记
    const endMarker = new THREE.Mesh(sphereGeo, sphereMat);
    endMarker.position.copy(endPos);
    endMarker.position.y += 0.5;
    this.scene3d.scene.add(endMarker);
    this.pathPoints.push(endMarker);
  }

  /**
   * 加载所有轨迹段进行回放
   */
  loadAllSegments() {
    if (this.trajectorySegments.length === 0) {
      console.warn('没有轨迹段可加载');
      return this;
    }
    
    // 合并所有轨迹段
    this.trajectoryData = [];
    let timeOffset = 0;
    
    this.trajectorySegments.forEach((segment, index) => {
      segment.data.forEach((point, i) => {
        this.trajectoryData.push({
          ...point,
          time: point.time + timeOffset,
          segmentIndex: index
        });
      });
      // 每段之间间隔1秒
      timeOffset += 5000 + 1000;
    });
    
    this.currentIndex = 0;
    this.currentTime = 0;
    
    console.log(`📊 加载了 ${this.trajectorySegments.length} 段轨迹，共 ${this.trajectoryData.length} 个轨迹点`);
    return this;
  }

  /**
   * 生成单段轨迹（兼容旧接口）
   */
  generateTrajectory(startCity, endCity, pointCount = 50) {
    return this.addSegment(startCity, endCity);
  }

  /**
   * 播放
   */
  play() {
    // 如果没有加载轨迹数据，先加载所有段
    if (this.trajectoryData.length === 0) {
      this.loadAllSegments();
    }
    
    if (this.trajectoryData.length === 0) {
      console.warn('没有轨迹数据可播放');
      return;
    }
    
    if (this.isPlaying) return;
    if (this.currentIndex >= this.trajectoryData.length - 1) {
      this.currentIndex = 0;
      this.currentTime = 0;
    }
    
    this.isPlaying = true;
    
    if (this.onPlay) {
      this.onPlay();
    }
    
    this._startPlayback();
  }

  /**
   * 暂停
   */
  pause() {
    this.isPlaying = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    if (this.onPause) {
      this.onPause();
    }
  }

  /**
   * 停止
   */
  stop() {
    this.pause();
    this.currentIndex = 0;
    this.currentTime = 0;
    this._updateVehiclePosition();
    
    if (this.onProgress) {
      this.onProgress(0);
    }
  }

  /**
   * 设置播放进度
   */
  setProgress(progress) {
    if (this.trajectoryData.length === 0) return;
    
    this.currentIndex = Math.floor(progress * (this.trajectoryData.length - 1));
    this.currentTime = this.trajectoryData[this.currentIndex]?.time || 0;
    this._updateVehiclePosition();
    
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  /**
   * 设置播放速度
   */
  setSpeed(speed) {
    this.playbackSpeed = Math.max(0.1, Math.min(5, speed));
  }

  /**
   * 开始回放
   */
  _startPlayback() {
    let lastTime = performance.now();
    
    const loop = (currentTime) => {
      if (!this.isPlaying) return;
      
      const deltaTime = (currentTime - lastTime) * this.playbackSpeed;
      lastTime = currentTime;
      
      this.currentTime += deltaTime;
      
      // 找到当前时间点
      while (this.currentIndex < this.trajectoryData.length - 1 &&
             this.trajectoryData[this.currentIndex + 1].time <= this.currentTime) {
        this.currentIndex++;
      }
      
      // 更新车辆位置
      this._updateVehiclePosition();
      
      // 更新进度
      const progress = this.currentIndex / (this.trajectoryData.length - 1);
      if (this.onProgress) {
        this.onProgress(progress);
      }
      
      // 检查是否完成
      if (this.currentIndex >= this.trajectoryData.length - 1) {
        this.pause();
        if (this.onComplete) {
          this.onComplete();
        }
        return;
      }
      
      this.animationId = requestAnimationFrame(loop);
    };
    
    this.animationId = requestAnimationFrame(loop);
  }

  /**
   * 更新车辆位置
   */
  _updateVehiclePosition() {
    if (!this.vehicle || this.trajectoryData.length === 0) return;
    
    const currentData = this.trajectoryData[this.currentIndex];
    const nextData = this.trajectoryData[this.currentIndex + 1];
    
    if (!currentData) return;
    
    let position = currentData.position.clone();
    
    // 插值计算
    if (nextData) {
      const timeDiff = nextData.time - currentData.time;
      const t = timeDiff > 0 ? (this.currentTime - currentData.time) / timeDiff : 0;
      position.lerp(nextData.position, t);
    }
    
    this.vehicle.setPosition(position);
    
    // 计算朝向
    if (nextData) {
      const direction = nextData.position.clone().sub(currentData.position).normalize();
      const angle = Math.atan2(direction.x, direction.z);
      this.vehicle.mesh.rotation.y = angle;
    }
  }

  /**
   * 绑定车辆
   */
  bindVehicle(vehicle) {
    this.vehicle = vehicle;
    if (this.trajectoryData.length > 0) {
      this._updateVehiclePosition();
    }
  }

  /**
   * 隐藏所有轨迹
   */
  hide() {
    this.pathLines.forEach(line => {
      line.visible = false;
    });
    this.pathPoints.forEach(point => {
      point.visible = false;
    });
    console.log('轨迹已隐藏');
  }

  /**
   * 显示所有轨迹
   */
  show() {
    this.pathLines.forEach(line => {
      line.visible = true;
    });
    this.pathPoints.forEach(point => {
      point.visible = true;
    });
    console.log('轨迹已显示');
  }

  /**
   * 切换轨迹显示/隐藏
   */
  toggleVisibility() {
    const isVisible = this.pathLines.length > 0 && this.pathLines[0].visible;
    if (isVisible) {
      this.hide();
    } else {
      this.show();
    }
    return !isVisible;
  }

  /**
   * 清除所有轨迹
   */
  clear() {
    this.stop();
    
    // 清除所有轨迹线
    this.pathLines.forEach(line => {
      this.scene3d.scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    });
    this.pathLines = [];
    
    // 清除所有标记
    this.pathPoints.forEach(point => {
      this.scene3d.scene.remove(point);
      point.geometry.dispose();
      point.material.dispose();
    });
    this.pathPoints = [];
    
    // 清除数据
    this.trajectorySegments = [];
    this.trajectoryData = [];
    this.currentIndex = 0;
    this.currentTime = 0;
    
    console.log('所有轨迹已清除');
  }

  /**
   * 清理
   */
  dispose() {
    this.clear();
    this.vehicle = null;
  }
}
