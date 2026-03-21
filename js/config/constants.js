// 常量配置
export const CONFIG = {
  // 渲染配置
  RENDER: {
    TARGET_FPS: 60,
    ENABLE_SHADOWS: true,
    ENABLE_ANTIALIAS: true
  },

  // 地图配置
  MAP: {
    CENTER: [104.5, 35.5],
    ZOOM: 4,
    CHINA_GEOJSON_URL: 'https://geo.datav.aliyun.com/areas_v3/bound/100000.json'
  },

  // 3D场景配置
  SCENE3D: {
    CAMERA_FOV: 60,
    CAMERA_NEAR: 0.1,
    CAMERA_FAR: 2000,
    CAMERA_POSITION: [0, 15, 20],
    GRID_SIZE: 50,
    GRID_DIVISIONS: 25
  },

  // 车辆配置
  VEHICLE: {
    DEFAULT_SPEED: 0.1,
    MAX_SPEED: 0.5,
    MIN_SPEED: 0.05,
    WHEEL_ROTATION_SPEED: 0.2
  },

  // 坐标转换配置
  COORDINATE: {
    SCALE: 1.5,
    CENTER_LNG: 120,
    CENTER_LAT: 30,
    OFFSET_Y: 0.5
  },

  // 热力图配置
  HEATMAP: {
    MAX_OPACITY: 0.8,
    MIN_OPACITY: 0.1,
    BLUR: 0.85,
    RADIUS: 15,
    GRADIENT: {
      0.4: 'blue',
      0.6: 'cyan',
      0.7: 'lime',
      0.8: 'yellow',
      1.0: 'red'
    }
  },

  // 区域聚合配置
  CLUSTER: {
    MAX_ZOOM: 15,
    RADIUS: 40,
    MIN_POINTS: 2
  }
};

// 城市数据
export const CITIES = {
  上海: { name: '上海', code: '310000', center: [121.48, 31.22], region: '华东' },
  北京: { name: '北京', code: '110000', center: [116.40, 39.90], region: '华北' },
  广州: { name: '广州', code: '440100', center: [113.23, 23.16], region: '华南' },
  深圳: { name: '深圳', code: '440300', center: [114.08, 22.55], region: '华南' },
  杭州: { name: '杭州', code: '330100', center: [120.15, 30.28], region: '华东' },
  南京: { name: '南京', code: '320100', center: [118.78, 32.07], region: '华东' },
  成都: { name: '成都', code: '510100', center: [104.07, 30.67], region: '西南' },
  西安: { name: '西安', code: '610100', center: [108.93, 34.27], region: '西北' },
  武汉: { name: '武汉', code: '420100', center: [114.31, 30.59], region: '华中' },
  重庆: { name: '重庆', code: '500000', center: [106.55, 29.57], region: '西南' },
  天津: { name: '天津', code: '120000', center: [117.20, 39.13], region: '华北' },
  苏州: { name: '苏州', code: '320500', center: [120.58, 31.30], region: '华东' },
  郑州: { name: '郑州', code: '410100', center: [113.62, 34.75], region: '华中' },
  长沙: { name: '长沙', code: '430100', center: [112.94, 28.23], region: '华中' },
  沈阳: { name: '沈阳', code: '210100', center: [123.43, 41.81], region: '东北' }
};

// 区域配置
export const REGIONS = {
  '华东': { color: '#ff6b6b', center: [120, 31] },
  '华北': { color: '#4ecdc4', center: [116, 39] },
  '华南': { color: '#45b7d1', center: [113, 23] },
  '华中': { color: '#f9ca24', center: [113, 30] },
  '西南': { color: '#6c5ce7', center: [105, 30] },
  '西北': { color: '#a29bfe', center: [108, 34] },
  '东北': { color: '#fd79a8', center: [123, 42] }
};

// 车辆类型
export const VEHICLE_TYPES = {
  TRUCK: { name: '货车', color: 0x1e90ff, size: [2, 1, 4] },
  VAN: { name: '面包车', color: 0xff6347, size: [1.8, 1.2, 3] },
  CONTAINER: { name: '集装箱车', color: 0x32cd32, size: [2.5, 1.5, 8] }
};

// 状态枚举
export const STATUS = {
  IDLE: 'idle',
  MOVING: 'moving',
  ARRIVED: 'arrived',
  LOADING: 'loading',
  UNLOADING: 'unloading'
};

// 视图模式
export const VIEW_MODE = {
  NORMAL: 'normal',
  HEATMAP: 'heatmap',
  CLUSTER: 'cluster',
  VEHICLES: 'vehicles'
};
