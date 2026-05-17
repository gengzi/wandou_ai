import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

interface ModelPreviewProps {
  url: string;
  name: string;
  filename?: string;
}

const modelFormat = (url: string, filename?: string) => {
  const source = `${filename || ''} ${url || ''}`.toLowerCase();
  if (source.match(/\.(glb|gltf)(\?|$|\s)/)) return 'gltf';
  if (source.match(/\.obj(\?|$|\s)/)) return 'obj';
  if (source.match(/\.stl(\?|$|\s)/)) return 'stl';
  return '';
};

export function canPreviewModel(url: string, filename?: string) {
  return Boolean(url) && Boolean(modelFormat(url, filename));
}

export default function ModelPreview({ url, name, filename }: ModelPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<() => void>(() => undefined);
  const [status, setStatus] = useState('加载中...');
  const [error, setError] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    const format = modelFormat(url, filename);
    if (!container || !url || !format) {
      setStatus('');
      setError(url ? '暂不支持该模型格式预览' : '模型文件待上传');
      return undefined;
    }

    setStatus('加载中...');
    setError('');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0c);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    camera.position.set(2.6, 1.8, 2.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.4, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 2.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4, 6, 4);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x86efac, 0.8);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(4, 16, 0x2f353b, 0x1f2429);
    grid.position.y = -0.02;
    scene.add(grid);

    let model: THREE.Object3D | null = null;
    let animationFrame = 0;
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const frameModel = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z, 0.1);
      const distance = maxSize * 1.9;
      object.position.sub(center);
      controls.target.set(0, 0, 0);
      camera.near = Math.max(maxSize / 100, 0.01);
      camera.far = Math.max(maxSize * 20, 100);
      camera.position.set(distance, distance * 0.7, distance);
      camera.updateProjectionMatrix();
      controls.update();
      resetRef.current = () => {
        camera.position.set(distance, distance * 0.7, distance);
        controls.target.set(0, 0, 0);
        controls.update();
      };
    };

    const material = new THREE.MeshStandardMaterial({
      color: 0xd7dde5,
      roughness: 0.62,
      metalness: 0.06,
    });

    const addModel = (object: THREE.Object3D) => {
      model = object;
      scene.add(object);
      frameModel(object);
      setStatus('');
    };

    const handleLoadError = (loadError: unknown) => {
      setStatus('');
      setError(loadError instanceof Error ? loadError.message : '模型加载失败');
    };

    if (format === 'gltf') {
      new GLTFLoader().load(url, (gltf) => addModel(gltf.scene), undefined, handleLoadError);
    } else if (format === 'obj') {
      new OBJLoader().load(url, addModel, undefined, handleLoadError);
    } else if (format === 'stl') {
      new STLLoader().load(url, (geometry) => {
        geometry.computeVertexNormals();
        addModel(new THREE.Mesh(geometry, material));
      }, undefined, handleLoadError);
    }

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      if (model) {
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const childMaterial = child.material;
            if (Array.isArray(childMaterial)) {
              childMaterial.forEach((item) => item.dispose());
            } else {
              childMaterial.dispose();
            }
          }
        });
      }
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [filename, url]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black/30">
      <div ref={containerRef} className="h-full w-full" aria-label={`${name} 3D预览`} />
      {(status || error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b0b0c] px-4 text-center text-xs text-slate-400">
          {error || status}
        </div>
      )}
      {!error && (
        <button
          type="button"
          onClick={() => resetRef.current()}
          className="absolute bottom-3 right-3 rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur hover:bg-black/70"
        >
          重置视角
        </button>
      )}
    </div>
  );
}
