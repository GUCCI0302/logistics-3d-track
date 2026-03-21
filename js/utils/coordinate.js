import * as THREE from 'three';
import { CONFIG } from '../config/constants.js';

/**
 * 坐标转换工具类
 * 将经纬度转换为3D场景坐标
 */
export class CoordinateConverter {
  constructor() {
    this.scale = CONFIG.COORDINATE.SCALE;
    this.centerLng = CONFIG.COORDINATE.CENTER_LNG;
    this.centerLat = CONFIG.COORDINATE.CENTER_LAT;
  }

  /**
   * 经纬度转3D坐标
   * @param {number} lng - 经度
   * @param {number} lat - 纬度
   * @returns {THREE.Vector3} 3D坐标
   */
  lngLatTo3D(lng, lat) {
    const x = (lng - this.centerLng) * this.scale;
    const z = (lat - this.centerLat) * this.scale;
    return new THREE.Vector3(x, CONFIG.COORDINATE.OFFSET_Y, z);
  }

  /**
   * 3D坐标转经纬度
   * @param {THREE.Vector3} pos - 3D坐标
   * @returns {number[]} [lng, lat]
   */
  toLngLat(pos) {
    const lng = pos.x / this.scale + this.centerLng;
    const lat = pos.z / this.scale + this.centerLat;
    return [lng, lat];
  }

  /**
   * 计算两点间距离
   * @param {number[]} point1 - [lng1, lat1]
   * @param {number[]} point2 - [lng2, lat2]
   * @returns {number} 距离（千米）
   */
  static calculateDistance(point1, point2) {
    const R = 6371; // 地球半径（千米）
    const dLat = (point2[1] - point1[1]) * Math.PI / 180;
    const dLon = (point2[0] - point1[0]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(point1[1] * Math.PI / 180) * Math.cos(point2[1] * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 计算两点间的3D距离
   * @param {THREE.Vector3} pos1 
   * @param {THREE.Vector3} pos2 
   * @returns {number}
   */
  static calculate3DDistance(pos1, pos2) {
    return pos1.distanceTo(pos2);
  }

  /**
   * 计算方位角
   * @param {THREE.Vector3} from 
   * @param {THREE.Vector3} to 
   * @returns {number} 弧度
   */
  static calculateAngle(from, to) {
    const direction = to.clone().sub(from).normalize();
    return Math.atan2(-direction.x, -direction.z);
  }
}

// 创建单例实例
export const coordinateConverter = new CoordinateConverter();
