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
  }
};

// 城市数据
export const CITIES = {
  上海: { name: '上海', code: '310000', center: [121.48, 31.22] },
  北京: { name: '北京', code: '110000', center: [116.40, 39.90] },
  广州: { name: '广州', code: '440100', center: [113.23, 23.16] },
  深圳: { name: '深圳', code: '440300', center: [114.08, 22.55] },
  杭州: { name: '杭州', code: '330100', center: [120.15, 30.28] },
  南京: { name: '南京', code: '320100', center: [118.78, 32.07] },
  成都: { name: '成都', code: '510100', center: [104.07, 30.67] },
  西安: { name: '西安', code: '610100', center: [108.93, 34.27] },
  武汉: { name: '武汉', code: '420100', center: [114.31, 30.59] },
  重庆: { name: '重庆', code: '500000', center: [106.55, 29.57] }
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
