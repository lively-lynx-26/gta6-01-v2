// Solmar Bay — Neon Tide: custom shaders for modern lighting. The ocean, the
// marina basin and the plaza fountain share one water shader: gentle sine
// waves in the vertex stage, a deep-to-shallow colour blend, a sun glint
// that follows the light, and manual fog so the water melts into the
// horizon exactly like the rest of the scene.

import * as THREE from 'three';
import { CFG } from './config.js';

const WATER_VERTEX = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPos;
  varying float vWave;
  void main() {
    vec3 p = position;
    // Two crossing sine waves, small enough to read as a swell, not a storm.
    float w = sin(p.x * 0.14 + uTime * 0.9) * 0.14
            + cos(p.y * 0.11 - uTime * 0.7) * 0.12
            + sin((p.x + p.y) * 0.05 + uTime * 0.5) * 0.08;
    p.z += w;
    vWave = w;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const WATER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorldPos;
  varying float vWave;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    // The swell tints the water between deep and shallow blue.
    float swell = clamp(vWave * 2.2 + 0.5, 0.0, 1.0);
    vec3 col = mix(uDeep, uShallow, swell);
    // A travelling sparkle, from a hashed ripple field.
    float sparkle = hash(floor(vWorldPos.xz * 2.0) + floor(uTime * 1.4));
    col += vec3(0.10) * step(0.93, sparkle) * (0.5 + 0.5 * sin(uTime * 2.0 + vWorldPos.x));
    // Sun glint: the reflection of the sun off the wave tops, strongest
    // when the view direction mirrors the sun.
    vec3 n = normalize(vec3(
      sin(vWorldPos.x * 0.14 + uTime * 0.9) * 0.10,
      sin(vWorldPos.z * 0.11 - uTime * 0.7) * 0.10,
      1.0));
    vec3 refl = reflect(-uSunDir, n);
    float glint = pow(max(dot(refl, viewDir), 0.0), 90.0);
    col += uSunColor * glint * 1.4;
    // Fresnel: grazing angles show the sky, steep angles the deep water.
    float fresnel = pow(1.0 - max(viewDir.z, 0.0), 2.0);
    col = mix(col, uSky, fresnel * 0.35);
    // Fog, matching the scene's own fog.
    float dist = length(cameraPosition - vWorldPos);
    float fogFactor = smoothstep(uFogNear, uFogFar, dist);
    col = mix(col, uFogColor, fogFactor);
    gl_FragColor = vec4(col, 0.94);
  }
`;

// One shared water material; the caller animates its uTime uniform.
export function makeWaterMaterial() {
  const sunDir = new THREE.Vector3(140, 200, 80).normalize();
  const material = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x1e6db0) },
      uShallow: { value: new THREE.Color(0x3f9fd8) },
      uSky: { value: new THREE.Color(CFG.sky.horizon) },
      uSunDir: { value: sunDir },
      uSunColor: { value: new THREE.Color(CFG.sky.sun) },
      uFogColor: { value: new THREE.Color(CFG.sky.fog) },
      uFogNear: { value: CFG.sky.fogNear },
      uFogFar: { value: CFG.sky.fogFar },
    },
    vertexShader: WATER_VERTEX,
    fragmentShader: WATER_FRAGMENT,
  });
  return material;
}

// Advance the water's clock. Call once per frame with the running game time.
export function animateWater(material, time) {
  material.uniforms.uTime.value = time;
}
