"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const CELL_PIXELS = 22;
const DARK_GRID = new THREE.Color(0.72, 0.58, 0.5);
const LIGHT_GRID = new THREE.Color(0.78, 0.72, 0.66);

export function FinalCtaBgCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    let w = Math.max(1, Math.round(rect.width));
    let h = Math.max(1, Math.round(rect.height));

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const isDark = () => document.documentElement.classList.contains("dark");

    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(w, h) },
        uCellPixels: { value: CELL_PIXELS },
        uGridColor: { value: (isDark() ? DARK_GRID : LIGHT_GRID).clone() },
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
        uniform float uCellPixels;
        uniform vec3 uGridColor;

        void main() {
          vec2 pixel = vUv * uResolution;

          // shift grid so a cell center lies exactly at viewport center
          vec2 gridShift = mod(uResolution * 0.5 - uCellPixels * 0.5, uCellPixels);
          vec2 shifted = pixel - gridShift;
          vec2 cellId = floor(shifted / uCellPixels);
          vec2 cellLocal = fract(shifted / uCellPixels);
          vec2 tileCenter = (cellId + 0.5) * uCellPixels + gridShift;

          float border = 0.03;
          float borderMask = step(cellLocal.x, border) + step(1.0 - border, cellLocal.x)
                           + step(cellLocal.y, border) + step(1.0 - border, cellLocal.y);
          borderMask = clamp(borderMask, 0.0, 1.0);

          vec3 coral = vec3(0.941, 0.541, 0.416);

          // > arrow shape — cell illumination based on distance from cell center to the chevron
          float cycle = 11.0;
          float phase = mod(uTime, cycle) / cycle;
          float arrowX = phase * (uResolution.x * 1.6) - uResolution.x * 0.3;
          float arrowY = uResolution.y * 0.5;
          float armHalfHeight = uResolution.y * 0.6;

          float dy = tileCenter.y - arrowY;
          float armX = arrowX - abs(dy);
          float tileDist = abs(tileCenter.x - armX);

          float illumRadius = uCellPixels * 2.8;
          float tileIllum = smoothstep(illumRadius, 0.0, tileDist);
          float armRange = smoothstep(armHalfHeight, armHalfHeight - uCellPixels * 0.5, abs(dy));
          tileIllum *= armRange;
          tileIllum = pow(tileIllum, 1.3);

          vec3 color = mix(uGridColor, coral, clamp(tileIllum, 0.0, 1.0));

          float baseAlpha = borderMask * 0.22;
          float illumBorderAlpha = borderMask * tileIllum * 0.9;
          float fillGlowAlpha = (1.0 - borderMask) * tileIllum * 0.1;
          float alpha = max(baseAlpha, illumBorderAlpha) + fillGlowAlpha;

          float edgeX = min(vUv.x, 1.0 - vUv.x);
          float edgeY = min(vUv.y, 1.0 - vUv.y);
          float edge = min(edgeX, edgeY);
          alpha *= smoothstep(0.0, 0.02, edge);

          gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
        }
      `,
    });

    scene.add(new THREE.Mesh(geo, mat));

    const clock = new THREE.Clock();
    let elapsed = 0;
    let rafId: number | null = null;
    function animate() {
      elapsed += clock.getDelta();
      mat.uniforms.uTime.value = elapsed;
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    }
    const startLoop = () => {
      if (rafId !== null) return;
      clock.getDelta();
      animate();
    };
    const stopLoop = () => {
      if (rafId === null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    };
    startLoop();

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) startLoop();
          else stopLoop();
        }
      },
      { threshold: 0 },
    );
    visibilityObserver.observe(container);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        canvas.style.opacity = "0.4";
      });
    });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const nextW = Math.max(1, Math.round(width));
        const nextH = Math.max(1, Math.round(height));
        if (nextW === w && nextH === h) continue;
        w = nextW;
        h = nextH;
        renderer.setSize(w, h, false);
        mat.uniforms.uResolution.value.set(w, h);
      }
    });
    resizeObserver.observe(container);

    const themeObserver = new MutationObserver(() => {
      mat.uniforms.uGridColor.value.copy(isDark() ? DARK_GRID : LIGHT_GRID);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      stopLoop();
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      mat.dispose();
      geo.dispose();
      renderer.dispose();
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      style={{
        width: "100%",
        height: "100%",
        opacity: 0,
        transition: "opacity 600ms ease-out",
      }}
    />
  );
}
