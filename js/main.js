import { Map2D } from './core/Map2D.js';
import { Scene3D } from './core/Scene3D.js';
import { Vehicle } from './core/Vehicle.js';
import { TrajectoryPlayer } from './core/TrajectoryPlayer.js';
import { CITIES, STATUS, VIEW_MODE, REGIONS } from './config/constants.js';
import { CoordinateConverter } from './utils/coordinate.js';
import { AnimationUtils } from './utils/animation.js';

/**
 * 物流轨迹可视化应用主类
 * 支持车辆点位、热力图、区域聚合
 */
class LogisticsApp {
  constructor() {
    this.map2d = null;
    this.scene3d = null;
    this.vehicles = new Map();
    this.trajectoryPlayer = null;
    this.currentVehicle = null;

    this.isLoading = true;
    this.viewMode = 'split';
    this.mapViewMode = VIEW_MODE.NORMAL;

    this.init();
  }

  /**
   * 初始化应用
   */
  async init() {
    console.log('开始初始化应用...');
    this._showLoader();

    try {
      // 初始化2D地图
      console.log('初始化2D地图...');
      this.map2d = new Map2D(document.getElementById('map2d'));
      this.map2d.onCityClick = (cityName) => this._handleCityClick(cityName);
      this.map2d.onVehicleClick = (vehicleData) => this._handleVehicleClick(vehicleData);
      this.map2d.onMapReady = () => this._onMapReady();

      // 初始化3D场景
      console.log('初始化3D场景...');
      this.scene3d = new Scene3D(document.getElementById('scene3d'));
      this.scene3d.onCityClick = (cityName) => this._handleCityClick(cityName);
      this.scene3d.onFPSUpdate = (fps) => this._updateFPS(fps);

      // 创建默认车辆
      console.log('创建默认车辆...');
      this._createDefaultVehicle();

      // 初始化轨迹播放器
      console.log('初始化轨迹播放器...');
      this.trajectoryPlayer = new TrajectoryPlayer(this.scene3d, this.map2d);

      // 创建UI
      console.log('创建UI...');
      this._createUI();

      // 等待地图加载完成
      console.log('等待地图加载...');
      await this._waitForMapReady();

      // 更新统计面板
      this._updateStatsPanel();

      // 隐藏加载器
      console.log('隐藏加载器...');
      this._hideLoader();

      console.log('物流轨迹可视化系统初始化完成！');
      this._showToast('系统初始化完成');

    } catch (error) {
      console.error('初始化失败:', error);
      this._hideLoader();
      this._showToast('初始化失败，请刷新页面重试', 'error');
    }
  }

  /**
   * 显示加载器
   */
  _showLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.classList.remove('hidden');
    }
  }

  /**
   * 隐藏加载器
   */
  _hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.classList.add('hidden');
    }
  }

  /**
   * 等待地图准备就绪
   */
  _waitForMapReady() {
    return new Promise((resolve) => {
      if (this.map2d.isReady) {
        resolve();
        return;
      }

      const maxWaitTime = 5000;
      const startTime = Date.now();

      const checkReady = () => {
        if (this.map2d.isReady) {
          console.log('地图就绪');
          resolve();
        } else if (Date.now() - startTime > maxWaitTime) {
          console.warn('地图加载超时，继续初始化');
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
  }

  /**
   * 地图准备就绪回调
   */
  _onMapReady() {
    console.log('地图加载完成');
  }

  /**
   * 创建默认车辆
   */
  _createDefaultVehicle() {
    const vehicle = new Vehicle('V001', '上海', this.scene3d.scene, {
      type: 'TRUCK',
      speed: 0.15
    });

    const startPos = this.scene3d.getCityPosition('上海');
    if (startPos) {
      vehicle.setPosition(startPos);
    }

    vehicle.onStatusChange = (status) => this._onVehicleStatusChange(vehicle, status);
    vehicle.onPositionUpdate = (position) => this._onVehiclePositionUpdate(vehicle, position);
    vehicle.onArrive = (cityName) => this._onVehicleArrive(vehicle, cityName);

    this.scene3d.addVehicle(vehicle);
    this.vehicles.set(vehicle.id, vehicle);
    this.currentVehicle = vehicle;

    this._updateVehiclePanel(vehicle);
  }

  /**
   * 处理城市点击
   */
  _handleCityClick(cityName) {
    if (!this.currentVehicle || this.currentVehicle.status === STATUS.MOVING) {
      this._showToast('车辆正在行驶中，请稍后再试');
      return;
    }

    if (this.currentVehicle.currentCity === cityName) {
      this._showToast(`车辆已在${cityName}`);
      return;
    }

    const fromCity = this.currentVehicle.currentCity;
    const targetPos = this.scene3d.getCityPosition(cityName);

    if (targetPos) {
      this.trajectoryPlayer.addSegment(fromCity, cityName);
      this.currentVehicle.moveTo(cityName, targetPos);
      this.map2d.highlightCity(cityName);
      this.scene3d.highlightCity(cityName);
      this._showToast(`车辆正在前往${cityName}`);
    }
  }

  /**
   * 处理车辆点击
   */
  _handleVehicleClick(vehicleData) {
    console.log('点击车辆:', vehicleData);
    this._showToast(`选中车辆: ${vehicleData.name} (${vehicleData.status})`);
    // 可以在这里添加更多车辆详情展示逻辑
  }

  /**
   * 车辆状态变化回调
   */
  _onVehicleStatusChange(vehicle, status) {
    this._updateVehiclePanel(vehicle);

    const statusText = {
      [STATUS.IDLE]: '空闲',
      [STATUS.MOVING]: '行驶中',
      [STATUS.ARRIVED]: '已到达'
    };

    console.log(`车辆 ${vehicle.id} 状态: ${statusText[status]}`);
  }

  /**
   * 车辆位置更新回调
   */
  _onVehiclePositionUpdate(vehicle, position) {
    if (vehicle.status === STATUS.MOVING && vehicle.targetPos) {
      const progressEl = document.getElementById('task-progress');
      if (progressEl) {
        const startPos = this.scene3d.getCityPosition(vehicle.currentCity);
        if (startPos) {
          const totalDist = startPos.distanceTo(vehicle.targetPos);
          const currentDist = position.distanceTo(vehicle.targetPos);
          const remainingProgress = Math.max(0, Math.min(100, (currentDist / totalDist) * 100));
          progressEl.style.width = `${remainingProgress}%`;
        }
      }
    }
  }

  /**
   * 车辆到达回调
   */
  _onVehicleArrive(vehicle, cityName) {
    this._showToast(`车辆已到达${cityName}`);
    this.map2d.highlightCity(cityName);
  }

  /**
   * 创建UI界面
   */
  _createUI() {
    this._createVehiclePanel();
    this._createControlPanel();
    this._createMapViewPanel();
    this._createStatsPanel();
    this._createCityListPanel();
    this._createFPSCounter();
    this._createToast();
  }

  /**
   * 创建车辆信息面板
   */
  _createVehiclePanel() {
    const panel = document.createElement('div');
    panel.className = 'vehicle-panel';
    panel.id = 'vehiclePanel';
    panel.innerHTML = `
      <h3>车辆信息</h3>
      <div class="info-item">
        <span>车辆编号</span>
        <span id="vehicle-id">--</span>
      </div>
      <div class="info-item">
        <span>当前位置</span>
        <span id="current-pos">--</span>
      </div>
      <div class="info-item">
        <span>目标位置</span>
        <span id="target-pos">--</span>
      </div>
      <div class="info-item">
        <span>行驶状态</span>
        <span id="vehicle-status" class="status-badge idle">空闲</span>
      </div>
      <div class="info-item">
        <span>当前速度</span>
        <span id="vehicle-speed">0 km/h</span>
      </div>
      <div class="progress-section">
        <div class="progress-label">任务进度</div>
        <div class="progress-bar">
          <div class="progress-fill" id="task-progress" style="width: 0%"></div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  /**
   * 更新车辆面板
   */
  _updateVehiclePanel(vehicle) {
    const panel = document.getElementById('vehiclePanel');
    if (!panel) return;

    document.getElementById('vehicle-id').textContent = vehicle.id;
    document.getElementById('current-pos').textContent = vehicle.currentCity || '--';
    document.getElementById('target-pos').textContent = vehicle.targetCity || '--';
    document.getElementById('vehicle-speed').textContent =
      vehicle.currentSpeed > 0 ? `${Math.round(vehicle.currentSpeed * 100)} km/h` : '0 km/h';

    const statusEl = document.getElementById('vehicle-status');
    statusEl.className = `status-badge ${vehicle.status}`;

    const statusText = {
      [STATUS.IDLE]: '空闲',
      [STATUS.MOVING]: '行驶中',
      [STATUS.ARRIVED]: '已到达'
    };
    statusEl.textContent = statusText[vehicle.status] || vehicle.status;

    const progressEl = document.getElementById('task-progress');
    if (vehicle.status === STATUS.MOVING && vehicle.targetPos) {
      const startPos = this.scene3d.getCityPosition(vehicle.currentCity);
      if (startPos) {
        const totalDist = startPos.distanceTo(vehicle.targetPos);
        const currentDist = vehicle.getPosition().distanceTo(vehicle.targetPos);
        const remainingProgress = Math.max(0, Math.min(100, (currentDist / totalDist) * 100));
        progressEl.style.width = `${remainingProgress}%`;
      }
    } else {
      progressEl.style.width = '0%';
    }
  }

  /**
   * 创建地图视图切换面板
   */
  _createMapViewPanel() {
    const panel = document.createElement('div');
    panel.className = 'map-view-panel';
    panel.innerHTML = `
      <h4>地图视图</h4>
      <div class="view-buttons">
        <button class="view-btn active" data-mode="normal">
          <span class="view-icon">🗺️</span>
          <span>标准</span>
        </button>
        <button class="view-btn" data-mode="vehicles">
          <span class="view-icon">🚛</span>
          <span>车辆</span>
        </button>
        <button class="view-btn" data-mode="heatmap">
          <span class="view-icon">🔥</span>
          <span>热力</span>
        </button>
        <button class="view-btn" data-mode="cluster">
          <span class="view-icon">📊</span>
          <span>聚合</span>
        </button>
      </div>
    `;
    document.body.appendChild(panel);

    // 绑定视图切换事件
    const buttons = panel.querySelectorAll('.view-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        this._setMapViewMode(mode);
      });
    });
  }

  /**
   * 设置地图视图模式
   */
  _setMapViewMode(mode) {
    this.mapViewMode = mode;
    if (this.map2d) {
      this.map2d.setViewMode(mode);
      this._showToast(`切换到${this._getViewModeName(mode)}视图`);
    }
  }

  /**
   * 获取视图模式名称
   */
  _getViewModeName(mode) {
    const names = {
      [VIEW_MODE.NORMAL]: '标准',
      [VIEW_MODE.VEHICLES]: '车辆点位',
      [VIEW_MODE.HEATMAP]: '热力图',
      [VIEW_MODE.CLUSTER]: '区域聚合'
    };
    return names[mode] || mode;
  }

  /**
   * 创建统计面板
   */
  _createStatsPanel() {
    const panel = document.createElement('div');
    panel.className = 'stats-panel';
    panel.id = 'statsPanel';
    panel.innerHTML = `
      <h4>车辆统计</h4>
      <div class="stats-content">
        <div class="stats-item">
          <span class="stats-label">总车辆数</span>
          <span class="stats-value" id="total-vehicles">0</span>
        </div>
        <div class="stats-grid" id="region-stats"></div>
        <div class="stats-legend">
          <div class="legend-title">状态分布</div>
          <div class="legend-items" id="status-legend"></div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  /**
   * 更新统计面板
   */
  _updateStatsPanel() {
    if (!this.map2d) return;

    const stats = this.map2d.getVehicleStats();

    // 更新总车辆数
    const totalEl = document.getElementById('total-vehicles');
    if (totalEl) {
      totalEl.textContent = stats.total;
    }

    // 更新区域统计
    const regionStatsEl = document.getElementById('region-stats');
    if (regionStatsEl) {
      regionStatsEl.innerHTML = Object.entries(stats.byRegion).map(([region, count]) => {
        const color = REGIONS[region]?.color || '#999';
        const percentage = Math.round((count / stats.total) * 100);
        return `
          <div class="region-stat-item">
            <div class="region-info">
              <span class="region-dot" style="background: ${color}"></span>
              <span class="region-name">${region}</span>
            </div>
            <div class="region-bar">
              <div class="region-fill" style="width: ${percentage}%; background: ${color}"></div>
            </div>
            <span class="region-count">${count}辆</span>
          </div>
        `;
      }).join('');
    }

    // 更新状态图例
    const statusLegendEl = document.getElementById('status-legend');
    if (statusLegendEl) {
      const statusColors = {
        '行驶中': '#00ff88',
        '空闲': '#1e90ff',
        '装货中': '#ffaa00',
        '卸货中': '#ff6b6b'
      };
      statusLegendEl.innerHTML = Object.entries(stats.byStatus).map(([status, count]) => `
        <div class="legend-item">
          <span class="legend-dot" style="background: ${statusColors[status] || '#999'}"></span>
          <span class="legend-text">${status}: ${count}辆</span>
        </div>
      `).join('');
    }
  }

  /**
   * 创建控制面板
   */
  _createControlPanel() {
    const panel = document.createElement('div');
    panel.className = 'control-panel';
    panel.innerHTML = `
      <button class="control-btn" id="play-btn">
        <span>▶</span> 回放
      </button>
      <button class="control-btn secondary" id="pause-btn">
        <span>⏸</span> 暂停
      </button>
      <button class="control-btn secondary" id="stop-btn">
        <span>⏹</span> 停止
      </button>
      <button class="control-btn secondary" id="toggle-trace-btn">
        <span>👁</span> 隐藏轨迹
      </button>
      <button class="control-btn secondary" id="clear-trace-btn">
        <span>🗑</span> 清除轨迹
      </button>
      <button class="control-btn secondary" id="refresh-stats-btn">
        <span>📊</span> 刷新统计
      </button>
      <div class="speed-control">
        <span>速度:</span>
        <input type="range" class="speed-slider" id="speed-slider"
               min="0.5" max="5" step="0.5" value="1">
        <span id="speed-value">1x</span>
      </div>
      <select class="view-mode-select" id="view-mode">
        <option value="split">分屏视图</option>
        <option value="2d">仅2D地图</option>
        <option value="3d">仅3D场景</option>
      </select>
    `;
    document.body.appendChild(panel);

    // 绑定事件
    document.getElementById('play-btn').addEventListener('click', () => this._playTrajectory());
    document.getElementById('pause-btn').addEventListener('click', () => this._pauseTrajectory());
    document.getElementById('stop-btn').addEventListener('click', () => this._stopTrajectory());
    document.getElementById('toggle-trace-btn').addEventListener('click', () => this._toggleTrace());
    document.getElementById('clear-trace-btn').addEventListener('click', () => this._clearTrace());
    document.getElementById('refresh-stats-btn').addEventListener('click', () => this._updateStatsPanel());

    const speedSlider = document.getElementById('speed-slider');
    speedSlider.addEventListener('input', (e) => {
      const speed = parseFloat(e.target.value);
      document.getElementById('speed-value').textContent = `${speed}x`;
      if (this.trajectoryPlayer) {
        this.trajectoryPlayer.setSpeed(speed);
      }
    });

    document.getElementById('view-mode').addEventListener('change', (e) => {
      this._setViewMode(e.target.value);
    });
  }

  /**
   * 播放轨迹
   */
  _playTrajectory() {
    if (!this.currentVehicle) {
      this._showToast('没有当前车辆');
      return;
    }

    if (!this.trajectoryPlayer.trajectoryData.length) {
      const cities = Object.keys(CITIES);
      const startCity = this.currentVehicle.currentCity || cities[0];
      const endCity = cities.find(c => c !== startCity) || cities[1];
      this.trajectoryPlayer.generateTrajectory(startCity, endCity, 100);
      this.trajectoryPlayer.bindVehicle(this.currentVehicle);
    }

    this.trajectoryPlayer.play();
    this._showToast('开始轨迹回放');
  }

  /**
   * 暂停轨迹
   */
  _pauseTrajectory() {
    if (this.trajectoryPlayer) {
      this.trajectoryPlayer.pause();
      this._showToast('轨迹回放已暂停');
    }
  }

  /**
   * 停止轨迹
   */
  _stopTrajectory() {
    if (this.trajectoryPlayer) {
      this.trajectoryPlayer.stop();
      this._showToast('轨迹回放已停止');
    }
  }

  /**
   * 切换轨迹显示/隐藏
   */
  _toggleTrace() {
    if (!this.trajectoryPlayer) return;

    const isVisible = this.trajectoryPlayer.toggleVisibility();
    const btn = document.getElementById('toggle-trace-btn');
    if (btn) {
      btn.innerHTML = isVisible ? '<span>👁</span> 隐藏轨迹' : '<span>👁</span> 显示轨迹';
    }
    this._showToast(isVisible ? '轨迹已显示' : '轨迹已隐藏');
  }

  /**
   * 清除轨迹
   */
  _clearTrace() {
    if (!this.trajectoryPlayer) return;

    this.trajectoryPlayer.clear();

    const btn = document.getElementById('toggle-trace-btn');
    if (btn) {
      btn.innerHTML = '<span>👁</span> 隐藏轨迹';
    }

    this._showToast('所有轨迹已清除');
  }

  /**
   * 设置视图模式
   */
  _setViewMode(mode) {
    this.viewMode = mode;
    const map2d = document.getElementById('map2d');
    const scene3d = document.getElementById('scene3d');

    switch (mode) {
      case '2d':
        map2d.style.width = '100%';
        scene3d.style.width = '0%';
        scene3d.style.display = 'none';
        map2d.style.display = 'block';
        break;
      case '3d':
        map2d.style.width = '0%';
        map2d.style.display = 'none';
        scene3d.style.width = '100%';
        scene3d.style.display = 'block';
        break;
      default:
        map2d.style.width = '50%';
        map2d.style.display = 'block';
        scene3d.style.width = '50%';
        scene3d.style.display = 'block';
    }

    window.dispatchEvent(new Event('resize'));
  }

  /**
   * 创建城市列表面板
   */
  _createCityListPanel() {
    const panel = document.createElement('div');
    panel.className = 'city-list-panel';
    panel.innerHTML = `
      <h4>城市列表</h4>
      <div id="city-list"></div>
    `;
    document.body.appendChild(panel);

    const cityList = document.getElementById('city-list');
    const cityEntries = Object.entries(CITIES);

    cityEntries.forEach(([name, data], index) => {
      const item = document.createElement('div');
      item.className = 'city-item';

      const isHighlight = index < 3;
      const dotClass = isHighlight ? 'highlight' : 'normal';

      item.innerHTML = `
        <span class="city-dot ${dotClass}"></span>
        <span>${name}</span>
      `;
      item.addEventListener('click', () => this._handleCityClick(name));
      cityList.appendChild(item);
    });
  }

  /**
   * 创建FPS计数器
   */
  _createFPSCounter() {
    const fps = document.createElement('div');
    fps.className = 'fps-counter';
    fps.id = 'fps-counter';
    fps.textContent = 'FPS: 60';
    document.body.appendChild(fps);
  }

  /**
   * 更新FPS显示
   */
  _updateFPS(fps) {
    const fpsEl = document.getElementById('fps-counter');
    if (fpsEl) {
      fpsEl.textContent = `FPS: ${fps}`;
      fpsEl.style.color = fps >= 50 ? '#0f0' : fps >= 30 ? '#ff0' : '#f00';
    }
  }

  /**
   * 创建Toast提示
   */
  _createToast() {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  /**
   * 显示Toast提示
   */
  _showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show');

      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  }

  /**
   * 销毁应用
   */
  dispose() {
    if (this.trajectoryPlayer) {
      this.trajectoryPlayer.dispose();
    }

    this.vehicles.forEach(vehicle => vehicle.dispose());
    this.vehicles.clear();

    if (this.map2d) {
      this.map2d.dispose();
    }

    if (this.scene3d) {
      this.scene3d.dispose();
    }
  }
}

// 导出全局实例
window.LogisticsApp = LogisticsApp;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.app = new LogisticsApp();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  if (window.app) {
    window.app.dispose();
  }
});
