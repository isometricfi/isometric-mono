"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";

const DESKTOP_CELL = 0.023;
const MOBILE_CELL = 0.045;
const DESKTOP_BREAKPOINT = 768;

const DARK_GRID = new THREE.Color(0.72, 0.58, 0.5);
const LIGHT_GRID = new THREE.Color(0.78, 0.72, 0.66);

const DARK_BG = new THREE.Color(0x16100e);
const LIGHT_BG = new THREE.Color(0xfef9f5);

const DARK_ILLUM = 1.1;
const LIGHT_ILLUM = 1.3;

export function HeroBgCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getSize = () => ({
      width: window.innerWidth,
      height: Math.round(window.innerHeight * 0.8),
    });

    let { width: w, height: h } = getSize();

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      // opaque canvas + non-premultiplied blend: alpha:false prevents Chrome's reload paint-holding
      // snapshot from showing gray in the transparent canvas region. premultipliedAlpha:false
      // switches the blend func to SRC_ALPHA/ONE_MINUS_SRC_ALPHA so the shader's non-premultiplied
      // output blends correctly against the cleared bg instead of adding a tan wash at alpha=0.
      alpha: false,
      premultipliedAlpha: false,
    });
    const isDark = () => document.documentElement.classList.contains("dark");
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(isDark() ? DARK_BG : LIGHT_BG, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const cellForWidth = (width: number) =>
      width >= DESKTOP_BREAKPOINT ? DESKTOP_CELL : MOBILE_CELL;

    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(w, h) },
        uSpeed: { value: 1.08 },
        uGlow: { value: 0.85 },
        uGridOpacity: { value: 0.75 },
        uCellSize: { value: cellForWidth(w) },
        uGridColor: { value: (isDark() ? DARK_GRID : LIGHT_GRID).clone() },
        uIllumStrength: { value: isDark() ? DARK_ILLUM : LIGHT_ILLUM },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform float uSpeed;
        uniform float uGlow;
        uniform float uGridOpacity;
        uniform float uCellSize;
        uniform vec3 uGridColor;
        uniform float uIllumStrength;

        float hash(float n) { return fract(sin(n) * 43758.5453); }

        float noise1D(float x) {
          float i = floor(x);
          float f = fract(x);
          float u = f * f * (3.0 - 2.0 * f);
          return mix(hash(i), hash(i + 1.0), u);
        }

        float priceCurve(float x, float t) {
          float y = 0.0;
          y += noise1D(x * 1.2 + t * 0.3) * 0.6;
          y += noise1D(x * 3.0 + t * 0.5) * 0.25;
          y += noise1D(x * 7.0 + t * 0.8) * 0.1;
          return y;
        }

        void main() {
          vec2 uv = vUv;
          float aspectRatio = uResolution.x / uResolution.y;
          float t = uTime * uSpeed;

          vec3 coral = vec3(0.941, 0.541, 0.416);

          float cellCount = max(1.0, floor(1.0 / uCellSize + 0.5));
          float cellX = 1.0 / cellCount;
          float cellY = cellX * aspectRatio;
          vec2 cellUv = vec2(uv.x / cellX, uv.y / cellY);
          vec2 cellId = floor(cellUv);
          vec2 cellLocal = fract(cellUv);

          float border = 0.02;
          float borderMask = step(cellLocal.x, border) + step(1.0 - border, cellLocal.x)
                           + step(cellLocal.y, border) + step(1.0 - border, cellLocal.y);
          borderMask = clamp(borderMask, 0.0, 1.0);

          float tileCenterX = (cellId.x + 0.5) * cellX;
          float tileCenterY = (cellId.y + 0.5) * cellY;
          float tileCurveY = 0.5 + (priceCurve(tileCenterX * 6.0, t) - 0.5) * 0.55;
          float tileDist = abs(tileCurveY - tileCenterY);

          float tileIllumRadius = mix(0.04, 0.18, uGlow);
          float tileIllum = smoothstep(tileIllumRadius, 0.0, tileDist);
          tileIllum = pow(tileIllum, 1.8) * uIllumStrength;

          vec3 color = mix(uGridColor, coral, clamp(tileIllum, 0.0, 1.0));

          float baseAlpha = borderMask * uGridOpacity * 0.35;
          float illumBorderAlpha = borderMask * tileIllum * 0.95;
          float fillGlowAlpha = (1.0 - borderMask) * tileIllum * 0.14;
          float alpha = max(baseAlpha, illumBorderAlpha) + fillGlowAlpha;

          vec2 centered = uv - vec2(0.5, 0.5);
          centered.x *= aspectRatio * 0.5;
          float vignette = smoothstep(0.08, 0.5, length(centered));
          alpha *= mix(0.5, 1.0, vignette);

          float bottomFade = smoothstep(0.0, 0.18, uv.y);
          alpha *= bottomFade;

          gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
        }
      `,
    });

    scene.add(new THREE.Mesh(geo, mat));

    const timer = new THREE.Timer();
    let rafId: number;

    function animate() {
      timer.update();
      mat.uniforms.uTime.value = timer.getElapsed();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    }
    animate();

    // double-rAF so the browser commits the initial opacity:0 paint before we flip to 0.7 — otherwise the transition is skipped
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        canvas.style.opacity = "0.7";
      });
    });

    const onResize = () => {
      const size = getSize();
      // ignore height-only changes — on mobile these are just the URL bar showing/hiding while scrolling, and resizing the shader causes the grid to visibly jump
      if (size.width === w) return;
      w = size.width;
      h = size.height;
      renderer.setSize(w, h, false);
      mat.uniforms.uResolution.value.set(w, h);
      mat.uniforms.uCellSize.value = cellForWidth(w);
    };
    window.addEventListener("resize", onResize);

    const themeObserver = new MutationObserver(() => {
      const dark = isDark();
      mat.uniforms.uGridColor.value.copy(dark ? DARK_GRID : LIGHT_GRID);
      mat.uniforms.uIllumStrength.value = dark ? DARK_ILLUM : LIGHT_ILLUM;
      renderer.setClearColor(dark ? DARK_BG : LIGHT_BG, 1);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      themeObserver.disconnect();
      mat.dispose();
      geo.dispose();
      renderer.dispose();
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      className="pointer-events-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "94vh",
        zIndex: 0,
        opacity: 0,
        transition: "opacity 500ms ease-out",
      }}
    />,
    document.body,
  );
}
