import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Activity, HeartPulse, Thermometer, Wind } from 'lucide-react';

const vitals = [
  { key: 'fc', label: 'FC', unit: 'lpm', color: '#ff4f5f', icon: HeartPulse },
  { key: 'fr', label: 'FR', unit: 'rpm', color: '#42a5ff', icon: Wind },
  { key: 'spo2', label: 'SpO2', unit: '%', color: '#38e27d', icon: Activity },
  { key: 'temperature', label: 'Temp', unit: '°C', color: '#ff9d2e', icon: Thermometer },
];

function drawMonitorTexture(caseData, phase) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#08121d');
  gradient.addColorStop(1, '#02070d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
  ctx.lineWidth = 2;
  for (let y = 72; y < canvas.height - 40; y += 72) {
    ctx.beginPath();
    ctx.moveTo(42, y);
    ctx.lineTo(canvas.width - 260, y);
    ctx.stroke();
  }
  for (let x = 42; x < canvas.width - 260; x += 70) {
    ctx.beginPath();
    ctx.moveTo(x, 56);
    ctx.lineTo(x, canvas.height - 70);
    ctx.stroke();
  }

  ctx.font = '700 34px "JetBrains Mono", monospace';
  ctx.fillStyle = '#e7f4ff';
  ctx.fillText('PulseLab Monitor', 42, 44);
  ctx.font = '500 20px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7da5b8';
  ctx.fillText('SIMULACION CLINICA EN TIEMPO REAL', 42, 78);

  const waveColors = ['#22d3ee', '#36e27a', '#ff4f5f', '#f8d24b'];
  waveColors.forEach((color, row) => {
    const baseY = 150 + row * 95;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let x = 48; x < canvas.width - 300; x += 5) {
      const t = (x + phase * (45 + row * 12)) / 38;
      const spike = Math.pow(Math.max(0, Math.sin(t)), 18) * 52;
      const y = baseY + Math.sin(t * 1.8) * 9 - spike + Math.sin(t * 0.45) * 7;
      if (x === 48) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  vitals.forEach((vital, index) => {
    const x = canvas.width - 238;
    const y = 112 + index * 110;
    const value = caseData?.[vital.key] || '--';

    ctx.fillStyle = 'rgba(10, 22, 34, 0.92)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, 190, 82, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = vital.color;
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText(vital.label, x + 18, y + 30);
    ctx.fillStyle = '#e7f4ff';
    ctx.font = '800 38px "JetBrains Mono", monospace';
    ctx.fillText(String(value), x + 18, y + 68);
    ctx.fillStyle = '#88a7b8';
    ctx.font = '500 17px "JetBrains Mono", monospace';
    ctx.fillText(vital.unit, x + 110, y + 68);
  });

  if (caseData?.pa_systolic || caseData?.pa_diastolic) {
    ctx.fillStyle = '#e7f4ff';
    ctx.font = '700 26px "JetBrains Mono", monospace';
    ctx.fillText(`PA ${caseData?.pa_systolic || '--'}/${caseData?.pa_diastolic || '--'} mmHg`, 42, canvas.height - 32);
  }

  return canvas;
}

export default function VitalSignsMonitor3D({ caseData }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0.18, 6.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    group.position.y = 0.16;
    group.rotation.x = -0.04;
    group.rotation.y = -0.14;
    scene.add(group);

    const rearShell = new THREE.Mesh(
      new THREE.BoxGeometry(5.75, 3.38, 0.34),
      new THREE.MeshStandardMaterial({ color: '#0a0f16', metalness: 0.5, roughness: 0.28 })
    );
    rearShell.position.z = -0.18;
    group.add(rearShell);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(5.45, 3.08, 0.3, 8, 8, 1),
      new THREE.MeshStandardMaterial({ color: '#111821', metalness: 0.35, roughness: 0.36 })
    );
    body.position.z = -0.02;
    group.add(body);

    const innerBezel = new THREE.Mesh(
      new THREE.BoxGeometry(4.9, 2.62, 0.08),
      new THREE.MeshStandardMaterial({ color: '#05080d', metalness: 0.22, roughness: 0.45 })
    );
    innerBezel.position.set(-0.17, 0.03, 0.17);
    group.add(innerBezel);

    const texture = new THREE.CanvasTexture(drawMonitorTexture(caseData, 0));
    texture.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(4.58, 2.35),
      new THREE.MeshBasicMaterial({ map: texture })
    );
    screen.position.set(-0.23, 0.03, 0.225);
    group.add(screen);

    const sidePanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 2.48, 0.11),
      new THREE.MeshStandardMaterial({ color: '#0b1118', metalness: 0.34, roughness: 0.4 })
    );
    sidePanel.position.set(2.52, 0.03, 0.22);
    group.add(sidePanel);

    const sideLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 2.22, 0.12),
      new THREE.MeshBasicMaterial({ color: '#21d4ff' })
    );
    sideLight.position.set(2.73, 0.03, 0.29);
    group.add(sideLight);

    const powerButtonMaterial = new THREE.MeshStandardMaterial({ color: '#1fef72', emissive: '#0b7a34', emissiveIntensity: 0.5 });
    const sideButtonMaterial = new THREE.MeshStandardMaterial({ color: '#253343', metalness: 0.2, roughness: 0.4 });
    [0.84, 0.42, 0, -0.42, -0.84].forEach((y, index) => {
      const button = new THREE.Mesh(
        new THREE.CylinderGeometry(index === 0 ? 0.085 : 0.065, index === 0 ? 0.085 : 0.065, 0.045, 28),
        index === 0 ? powerButtonMaterial : sideButtonMaterial
      );
      button.rotation.x = Math.PI / 2;
      button.position.set(2.52, y, 0.31);
      group.add(button);
    });

    const screwMaterial = new THREE.MeshStandardMaterial({ color: '#4b5b69', metalness: 0.8, roughness: 0.24 });
    [
      [-2.48, 1.33],
      [2.22, 1.33],
      [-2.48, -1.33],
      [2.22, -1.33],
    ].forEach(([x, y]) => {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 20), screwMaterial);
      screw.rotation.x = Math.PI / 2;
      screw.position.set(x, y, 0.245);
      group.add(screw);
    });

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.14, 0.72, 28),
      new THREE.MeshStandardMaterial({ color: '#263543', metalness: 0.7, roughness: 0.28 })
    );
    stand.position.set(0, -1.95, -0.12);
    group.add(stand);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.98, 0.13, 42),
      new THREE.MeshStandardMaterial({ color: '#141d27', metalness: 0.5, roughness: 0.35 })
    );
    base.position.set(0, -2.33, -0.12);
    group.add(base);

    scene.add(new THREE.AmbientLight('#8edcff', 0.55));
    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(2, 3, 5);
    scene.add(key);
    const cyan = new THREE.PointLight('#20d4ff', 2.3, 9);
    cyan.position.set(-2.2, 1.4, 2.2);
    scene.add(cyan);
    const green = new THREE.PointLight('#46e278', 1.2, 7);
    green.position.set(2.4, -1, 1.8);
    scene.add(green);

    let frame;
    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      group.rotation.y = -0.14 + Math.sin(elapsed * 0.7) * 0.018;
      group.rotation.x = -0.04 + Math.sin(elapsed * 0.45) * 0.009;
      texture.image = drawMonitorTexture(caseData, elapsed);
      texture.needsUpdate = true;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    const resize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [caseData]);

  return (
    <section className="rounded-2xl border border-border bg-secondary/20 p-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Activity className="h-4 w-4 text-primary animate-vital" />
        <h2 className="text-sm font-semibold">Monitor 3D de signos vitales</h2>
      </div>
      <div
        ref={mountRef}
        className="h-[340px] w-full overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_22%,rgba(34,211,238,0.14),transparent_42%),linear-gradient(180deg,#0e141c,#070b10)] sm:h-[360px]"
      />
    </section>
  );
}
