import { CONFIG, CITIES, REGIONS, VIEW_MODE } from '../config/constants.js';

/**
 * 2D地图管理类
 * 支持车辆点位、热力图、区域聚合
 */
export class Map2D {
  constructor(container) {
    this.container = container;
    this.chart = null;
    this.cityData = [];
    this.lineData = [];
    this.isReady = false;
    this.viewMode = VIEW_MODE.NORMAL;

    // 车辆点位数据
    this.vehiclePoints = [];
    this.vehicleMarkers = new Map();

    // 热力图数据
    this.heatmapData = [];

    // 聚合数据
    this.clusterData = [];

    this.onCityClick = null;
    this.onMapReady = null;
    this.onVehicleClick = null;

    this._init();
  }

  /**
   * 初始化地图
   */
  async _init() {
    this.chart = echarts.init(this.container);

    // 窗口大小变化
    window.addEventListener('resize', () => {
      if (this.chart) {
        this.chart.resize();
      }
    });

    // 加载中国地图数据
    try {
      const response = await fetch(CONFIG.MAP.CHINA_GEOJSON_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const chinaGeoJSON = await response.json();
      echarts.registerMap('china', chinaGeoJSON);

      this._prepareData();
      this._generateMockData();
      this._setOption();
      this._setupEventListeners();

      this.isReady = true;
      if (this.onMapReady) {
        this.onMapReady();
      }
      console.log('地图数据加载成功');
    } catch (error) {
      console.error('加载地图数据失败:', error);
      this._useFallbackMap();
    }
  }

  /**
   * 准备数据
   */
  _prepareData() {
    // 城市数据
    this.cityData = Object.entries(CITIES).map(([name, data]) => ({
      name: name,
      value: [...data.center, 100],
      label: name,
      region: data.region
    }));

    // 线路数据（连接主要城市）
    const mainCities = ['北京', '上海', '广州', '深圳', '成都', '西安'];
    this.lineData = [];

    for (let i = 0; i < mainCities.length; i++) {
      for (let j = i + 1; j < mainCities.length; j++) {
        const city1 = CITIES[mainCities[i]];
        const city2 = CITIES[mainCities[j]];
        if (city1 && city2) {
          this.lineData.push({
            coords: [city1.center, city2.center],
            lineStyle: {
              color: Math.random() > 0.5 ? '#ff4500' : '#1e90ff',
              width: 2,
              opacity: 0.6
            }
          });
        }
      }
    }
  }

  /**
   * 生成模拟数据
   */
  _generateMockData() {
    // 生成车辆点位数据
    this.vehiclePoints = [];
    const vehicleTypes = ['货车', '面包车', '集装箱车'];
    const statuses = ['行驶中', '空闲', '装货中', '卸货中'];

    Object.entries(CITIES).forEach(([cityName, data]) => {
      // 每个城市生成 3-8 辆车
      const vehicleCount = Math.floor(Math.random() * 6) + 3;
      for (let i = 0; i < vehicleCount; i++) {
        // 在城市周围随机分布
        const offsetLng = (Math.random() - 0.5) * 2;
        const offsetLat = (Math.random() - 0.5) * 2;
        this.vehiclePoints.push({
          id: `V${cityName}${String(i + 1).padStart(3, '0')}`,
          name: `${cityName}-${vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)]}-${i + 1}`,
          value: [
            data.center[0] + offsetLng,
            data.center[1] + offsetLat,
            Math.floor(Math.random() * 100) + 20 // 速度值
          ],
          city: cityName,
          region: data.region,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          type: vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)]
        });
      }
    });

    // 生成热力图数据（基于车辆密度）
    this.heatmapData = this.vehiclePoints.map(v => ({
      value: [v.value[0], v.value[1], Math.random() * 100],
      name: v.name
    }));

    // 生成聚合数据
    this._updateClusterData();
  }

  /**
   * 更新聚合数据
   */
  _updateClusterData() {
    const regionGroups = {};

    // 按区域分组
    this.vehiclePoints.forEach(vehicle => {
      const region = vehicle.region;
      if (!regionGroups[region]) {
        regionGroups[region] = {
          region: region,
          vehicles: [],
          center: REGIONS[region]?.center || [0, 0],
          color: REGIONS[region]?.color || '#999'
        };
      }
      regionGroups[region].vehicles.push(vehicle);
    });

    // 生成聚合点
    this.clusterData = Object.values(regionGroups).map(group => ({
      name: group.region,
      value: [...group.center, group.vehicles.length],
      count: group.vehicles.length,
      region: group.region,
      color: group.color,
      vehicles: group.vehicles
    }));
  }

  /**
   * 设置图表配置
   */
  _setOption() {
    const baseOption = {
      title: {
        text: '物流车辆轨迹',
        left: 'center',
        top: 10,
        textStyle: {
          fontSize: 18,
          fontWeight: 'bold',
          color: '#333'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.seriesType === 'scatter' && params.seriesName === '车辆点位') {
            return `<div style="font-weight:bold">${params.data.name}</div>
                    <div>车辆ID: ${params.data.id}</div>
                    <div>所在城市: ${params.data.city}</div>
                    <div>所属区域: ${params.data.region}</div>
                    <div>当前状态: ${params.data.status}</div>
                    <div>速度: ${params.data.value[2]} km/h</div>`;
          }
          if (params.seriesType === 'heatmap') {
            return `热力值: ${params.data.value[2].toFixed(2)}`;
          }
          if (params.seriesType === 'scatter' && params.seriesName === '区域聚合') {
            return `<div style="font-weight:bold">${params.data.name}区域</div>
                    <div>车辆数量: ${params.data.count} 辆</div>
                    <div>点击查看详情</div>`;
          }
          if (params.seriesType === 'scatter') {
            return `${params.name}<br/>经度: ${params.value[0]}<br/>纬度: ${params.value[1]}`;
          }
          return params.name;
        }
      },
      geo: {
        map: 'china',
        roam: true,
        zoom: 1.2,
        center: CONFIG.MAP.CENTER,
        label: {
          show: true,
          color: '#333',
          fontSize: 10
        },
        itemStyle: {
          areaColor: '#e8f4fd',
          borderColor: '#1e90ff',
          borderWidth: 1
        },
        emphasis: {
          label: {
            show: true,
            color: '#000'
          },
          itemStyle: {
            areaColor: '#d0e8f7'
          }
        }
      }
    };

    let series = [];

    // 根据视图模式选择不同的系列
    switch (this.viewMode) {
      case VIEW_MODE.HEATMAP:
        series = this._getHeatmapSeries();
        break;
      case VIEW_MODE.CLUSTER:
        series = this._getClusterSeries();
        break;
      case VIEW_MODE.VEHICLES:
        series = this._getVehicleSeries();
        break;
      default:
        series = this._getNormalSeries();
    }

    baseOption.series = series;
    this.chart.setOption(baseOption, true);
  }

  /**
   * 获取普通视图系列
   */
  _getNormalSeries() {
    return [
      {
        type: 'lines',
        coordinateSystem: 'geo',
        data: this.lineData,
        effect: {
          show: true,
          period: 6,
          trailLength: 0.7,
          color: '#fff',
          symbolSize: 3
        },
        lineStyle: {
          curveness: 0.2
        }
      },
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        data: this.cityData,
        symbolSize: 15,
        itemStyle: {
          color: '#1e90ff',
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)'
        },
        emphasis: {
          symbolSize: 20,
          itemStyle: {
            color: '#ff4500'
          }
        },
        label: {
          show: true,
          formatter: '{b}',
          position: 'right',
          fontSize: 12,
          color: '#333',
          backgroundColor: 'rgba(255,255,255,0.8)',
          padding: [4, 8],
          borderRadius: 4
        }
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: this.cityData.slice(0, 3),
        symbolSize: 20,
        showEffectOn: 'render',
        rippleEffect: {
          brushType: 'stroke',
          scale: 3
        },
        itemStyle: {
          color: '#ff4500'
        }
      }
    ];
  }

  /**
   * 获取车辆点位系列
   */
  _getVehicleSeries() {
    const statusColors = {
      '行驶中': '#00ff88',
      '空闲': '#1e90ff',
      '装货中': '#ffaa00',
      '卸货中': '#ff6b6b'
    };

    return [
      {
        name: '车辆点位',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: this.vehiclePoints,
        symbolSize: (val) => Math.sqrt(val[2]) + 5,
        itemStyle: {
          color: (params) => statusColors[params.data.status] || '#999',
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)'
        },
        emphasis: {
          symbolSize: 25,
          itemStyle: {
            shadowBlur: 20,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        label: {
          show: false
        }
      },
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        data: this.cityData,
        symbolSize: 10,
        itemStyle: {
          color: 'rgba(30, 144, 255, 0.3)'
        },
        label: {
          show: true,
          formatter: '{b}',
          position: 'right',
          fontSize: 11,
          color: '#666'
        }
      }
    ];
  }

  /**
   * 获取热力图系列
   */
  _getHeatmapSeries() {
    return [
      {
        name: '车辆热力',
        type: 'heatmap',
        coordinateSystem: 'geo',
        data: this.heatmapData,
        pointSize: CONFIG.HEATMAP.RADIUS,
        blurSize: CONFIG.HEATMAP.BLUR * 20,
        maxOpacity: CONFIG.HEATMAP.MAX_OPACITY,
        minOpacity: CONFIG.HEATMAP.MIN_OPACITY,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'blue' },
              { offset: 0.4, color: 'cyan' },
              { offset: 0.6, color: 'lime' },
              { offset: 0.8, color: 'yellow' },
              { offset: 1, color: 'red' }
            ]
          }
        }
      },
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        data: this.cityData,
        symbolSize: 8,
        itemStyle: {
          color: 'rgba(0, 0, 0, 0.3)'
        },
        label: {
          show: true,
          formatter: '{b}',
          position: 'right',
          fontSize: 10,
          color: '#333'
        }
      }
    ];
  }

  /**
   * 获取区域聚合系列
   */
  _getClusterSeries() {
    return [
      {
        name: '区域聚合',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: this.clusterData,
        symbolSize: (val) => Math.sqrt(val[2]) * 8 + 20,
        itemStyle: {
          color: (params) => params.data.color,
          shadowBlur: 15,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
          opacity: 0.8
        },
        emphasis: {
          symbolSize: (val) => Math.sqrt(val[2]) * 8 + 30,
          itemStyle: {
            shadowBlur: 25,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
            opacity: 1
          }
        },
        label: {
          show: true,
          formatter: (params) => `${params.data.region}\n${params.data.count}辆`,
          position: 'inside',
          fontSize: 12,
          fontWeight: 'bold',
          color: '#fff'
        }
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: this.clusterData.filter(d => d.count > 10),
        symbolSize: (val) => Math.sqrt(val[2]) * 8 + 30,
        showEffectOn: 'render',
        rippleEffect: {
          brushType: 'stroke',
          scale: 2,
          period: 4
        },
        itemStyle: {
          color: 'transparent',
          borderColor: '#fff',
          borderWidth: 2
        }
      }
    ];
  }

  /**
   * 使用简化地图（fallback）
   */
  _useFallbackMap() {
    const fallbackMap = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { name: '中国' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[73.4, 18.1], [135.1, 18.1], [135.1, 53.6], [73.4, 53.6], [73.4, 18.1]]]
        }
      }]
    };

    echarts.registerMap('china', fallbackMap);
    this._prepareData();
    this._generateMockData();
    this._setOption();
    this._setupEventListeners();

    this.isReady = true;
    if (this.onMapReady) {
      this.onMapReady();
    }
  }

  /**
   * 设置事件监听
   */
  _setupEventListeners() {
    this.chart.on('click', (params) => {
      if (params.componentType === 'series') {
        if (params.seriesType === 'scatter' || params.seriesType === 'effectScatter') {
          if (params.seriesName === '车辆点位') {
            if (this.onVehicleClick) {
              this.onVehicleClick(params.data);
            }
          } else if (params.seriesName === '区域聚合') {
            this._showRegionDetails(params.data);
          } else {
            const cityName = params.name;
            if (this.onCityClick) {
              this.onCityClick(cityName);
            }
          }
        }
      }
    });

    this.chart.on('mouseover', (params) => {
      if (params.componentType === 'series' && params.seriesType === 'scatter') {
        this.container.style.cursor = 'pointer';
      }
    });

    this.chart.on('mouseout', () => {
      this.container.style.cursor = 'default';
    });
  }

  /**
   * 显示区域详情
   */
  _showRegionDetails(regionData) {
    console.log('区域详情:', regionData);
    // 可以在这里触发一个自定义事件或回调
  }

  /**
   * 切换视图模式
   */
  setViewMode(mode) {
    this.viewMode = mode;
    this._setOption();
  }

  /**
   * 获取当前视图模式
   */
  getViewMode() {
    return this.viewMode;
  }

  /**
   * 添加车辆点位
   */
  addVehiclePoint(vehicleData) {
    this.vehiclePoints.push({
      id: vehicleData.id,
      name: vehicleData.name || vehicleData.id,
      value: [vehicleData.lng, vehicleData.lat, vehicleData.speed || 0],
      city: vehicleData.city,
      region: vehicleData.region,
      status: vehicleData.status || '空闲',
      type: vehicleData.type || '货车'
    });
    this._updateClusterData();
    if (this.viewMode === VIEW_MODE.VEHICLES) {
      this._setOption();
    }
  }

  /**
   * 更新车辆位置
   */
  updateVehiclePosition(vehicleId, lng, lat, speed) {
    const vehicle = this.vehiclePoints.find(v => v.id === vehicleId);
    if (vehicle) {
      vehicle.value[0] = lng;
      vehicle.value[1] = lat;
      vehicle.value[2] = speed || 0;
      if (this.viewMode === VIEW_MODE.VEHICLES) {
        this._setOption();
      }
    }
  }

  /**
   * 移除车辆点位
   */
  removeVehiclePoint(vehicleId) {
    const index = this.vehiclePoints.findIndex(v => v.id === vehicleId);
    if (index > -1) {
      this.vehiclePoints.splice(index, 1);
      this._updateClusterData();
      if (this.viewMode === VIEW_MODE.VEHICLES) {
        this._setOption();
      }
    }
  }

  /**
   * 获取车辆统计数据
   */
  getVehicleStats() {
    const stats = {
      total: this.vehiclePoints.length,
      byRegion: {},
      byStatus: {},
      byCity: {}
    };

    this.vehiclePoints.forEach(v => {
      // 按区域统计
      stats.byRegion[v.region] = (stats.byRegion[v.region] || 0) + 1;
      // 按状态统计
      stats.byStatus[v.status] = (stats.byStatus[v.status] || 0) + 1;
      // 按城市统计
      stats.byCity[v.city] = (stats.byCity[v.city] || 0) + 1;
    });

    return stats;
  }

  /**
   * 高亮城市
   */
  highlightCity(cityName) {
    if (!this.isReady) return;

    this.chart.dispatchAction({
      type: 'highlight',
      seriesIndex: 1,
      name: cityName
    });

    setTimeout(() => {
      this.chart.dispatchAction({
        type: 'downplay',
        seriesIndex: 1,
        name: cityName
      });
    }, 2000);
  }

  /**
   * 获取城市坐标
   */
  getCityCenter(cityName) {
    const city = CITIES[cityName];
    return city ? city.center : null;
  }

  /**
   * 销毁地图
   */
  dispose() {
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
  }
}
