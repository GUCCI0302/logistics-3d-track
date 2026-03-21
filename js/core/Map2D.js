import { CONFIG, CITIES } from '../config/constants.js';

/**
 * 2D地图管理类
 */
export class Map2D {
  constructor(container) {
    this.container = container;
    this.chart = null;
    this.cityData = [];
    this.lineData = [];
    this.isReady = false;
    
    this.onCityClick = null;
    this.onMapReady = null;
    
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
      this._setOption();
      this._setupEventListeners();
      
      this.isReady = true;
      if (this.onMapReady) {
        this.onMapReady();
      }
      console.log('地图数据加载成功');
    } catch (error) {
      console.error('加载地图数据失败:', error);
      // 使用简化地图作为 fallback
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
      label: name
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
   * 设置图表配置
   */
  _setOption() {
    const option = {
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
      },
      series: [
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
      ]
    };
    
    this.chart.setOption(option);
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
      // 监听 scatter 和 effectScatter 系列的点击事件
      if (params.componentType === 'series' && 
          (params.seriesType === 'scatter' || params.seriesType === 'effectScatter')) {
        const cityName = params.name;
        if (this.onCityClick) {
          this.onCityClick(cityName);
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
   * 添加车辆标记
   */
  addVehicleMarker(vehicleId, cityName) {
    if (!this.isReady) return;
    
    const city = CITIES[cityName];
    if (!city) return;
    
    // 这里可以添加车辆标记逻辑
    console.log(`车辆 ${vehicleId} 添加到 ${cityName}`);
  }

  /**
   * 更新车辆位置
   */
  updateVehiclePosition(vehicleId, position) {
    // 可以添加实时位置更新逻辑
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
