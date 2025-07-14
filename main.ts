import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import beeModelPath from './static/bee.glb';
import glassesModelPath from './static/glasses.glb';

const BEE_CHANCE = 1;
const INITIAL_BEES = 10;
const SCENE_WIDTH = 5;
const BEE_SPEED = 5;

const UP = new THREE.Vector3(0,1,0);
const FORWARD = new THREE.Vector3(0,0,1);
const RIGHT = new THREE.Vector3(1,0,0);


const scene = new THREE.Scene();
const aspectRatio = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera( -SCENE_WIDTH, SCENE_WIDTH, SCENE_WIDTH / aspectRatio, -SCENE_WIDTH / aspectRatio, 1, 1000 );
const canvas = document.querySelector("#c")!;
const renderer = new THREE.WebGLRenderer({antialias: true, canvas: canvas, alpha: true});
document.body.appendChild( renderer.domElement );
camera.position.z = 5;

const bees: Array<THREE.Group> = [];
const loader = new GLTFLoader();
const clock = new THREE.Clock();
const cameraBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(SCENE_WIDTH*2, SCENE_WIDTH * 2 / aspectRatio, 100));
const cameraAxis = new THREE.Vector3(0, 0, 1);

const color = 0xFFFFFF;
const intensity = 2.5;
const light = new THREE.AmbientLight(color, intensity);
scene.add(light);

const random = (max: number, offset: number) => {
  return Math.random() * max + offset;
}

const resizeRendererToDisplaySize = (renderer) => {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
  }
  return needResize;
}

const loadModel = async (path: string): Promise<GLTF> => {
  const model = await loader.loadAsync(path);
  return model;
}

const beeModel = await loadModel(beeModelPath);
const glassesModel = await loadModel(glassesModelPath)

const initBee = () => {
  const aspectRatio = window.innerWidth / window.innerHeight;
  const newBee = beeModel.scene.clone();
  const beeDirection = new THREE.Vector3(random(2, -1), random(2, -1), 0).normalize();
  const beeEntryPoint = new THREE.Vector3(SCENE_WIDTH * -beeDirection.x, SCENE_WIDTH / aspectRatio * -beeDirection.y, 0);
  const beeStart = beeEntryPoint.multiplyScalar(1.5);
  newBee.translateOnAxis(beeStart, 1);
  newBee.scale.setScalar(random(20, 40));
  newBee.userData.animMixer = new THREE.AnimationMixer(newBee);
  beeModel.animations.forEach(anim => {
    newBee.userData.animMixer.clipAction(anim).play();
  });
  newBee.userData.boundingBox = new THREE.Box3().setFromObject(newBee);
  newBee.userData.speed = (Math.random() / 2 + 0.5) * BEE_SPEED;
  newBee.userData.rotationVector = new THREE.Vector3().random().multiplyScalar(5);
  newBee.userData.appeared = false;
  newBee.userData.beeDirection = beeDirection;
  newBee.userData.beeUp = beeDirection.clone().applyAxisAngle(FORWARD, Math.PI / 2);
  newBee.userData.mirrored = false;
  newBee.userData.randomRotation = new THREE.Vector3();
  newBee.userData.randomRotationProgress = 1;
  newBee.rotateX(Math.PI);
  if (beeDirection.x < 0) {
    newBee.rotateY(Math.PI);
    newBee.userData.beeUp.negate();
    newBee.userData.mirrored = true;
  }
  newBee.rotateZ(-beeDirection.y);

  let glasses = glassesModel.scene.clone();
  glasses.scale.setScalar(0.00015);
  glasses.rotateY(Math.PI / 2)
  glasses.translateZ(0.007)
  glasses.scale.setX(0.5 * glasses.scale.x);
  newBee.add(glasses);

  scene.add(newBee);
  bees.push(newBee);
}

const animate = () => {
  const clockDelta = clock.getDelta();
  const leftVector = new THREE.Vector3();
  bees.forEach(bee => {
    if (!bee.userData.appeared) {
      bee.position.x += bee.userData.beeDirection.x * clockDelta * BEE_SPEED;
      bee.position.y += bee.userData.beeDirection.y * clockDelta * BEE_SPEED;
      bee.userData.boundingBox.translate(bee.userData.beeDirection.clone().multiplyScalar(clockDelta * BEE_SPEED));
      if (cameraBox.intersectsBox(bee.userData.boundingBox)) {
        bee.userData.appeared = true;
      }
    } else {
      bee.getWorldDirection(leftVector);
      let forwardVector = leftVector.clone().applyAxisAngle(bee.userData.beeUp, -Math.PI / 2);
      bee.position.x += forwardVector.x * clockDelta * BEE_SPEED;
      bee.position.y += forwardVector.y * clockDelta * BEE_SPEED;
      bee.userData.boundingBox.translate(forwardVector.clone().multiplyScalar(clockDelta * BEE_SPEED).setComponent(2, 0));
      bee.rotateX(bee.userData.rotationVector.x * clockDelta);
      bee.rotateY(bee.userData.rotationVector.y * clockDelta);
      bee.rotateZ(bee.userData.rotationVector.z * clockDelta);
      bee.userData.beeUp.applyAxisAngle(forwardVector, bee.userData.rotationVector.x * clockDelta);
      bee.userData.beeUp.applyAxisAngle(leftVector, bee.userData.rotationVector.z * clockDelta);
      if (bee.userData.randomRotationProgress >= 1) {
        bee.userData.randomRotation.random().multiplyScalar(2).subScalar(1).normalize();
        bee.userData.randomRotationProgress = 0;
      } else {
        bee.getWorldDirection(leftVector);
        forwardVector = leftVector.clone().applyAxisAngle(bee.userData.beeUp, -Math.PI / 2);
        bee.userData.randomRotationProgress += clockDelta;
        bee.rotateX(bee.userData.randomRotation.x * clockDelta);
        bee.rotateY(bee.userData.randomRotation.y * clockDelta);
        bee.rotateZ(bee.userData.randomRotation.z * clockDelta);
        bee.userData.beeUp.applyAxisAngle(forwardVector, bee.userData.randomRotation.x * clockDelta);
        bee.userData.beeUp.applyAxisAngle(leftVector, bee.userData.randomRotation.z * clockDelta);
      }
      if (!cameraBox.intersectsBox(bee.userData.boundingBox)) {
        bee.removeFromParent();
        bees.splice(bees.indexOf(bee),1);
      }
    }
    bee.userData.animMixer.update(clockDelta);
  });
  if (resizeRendererToDisplaySize(renderer)) {
    const canvas = renderer.domElement;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    camera.top = camera.left / aspect;
    camera.bottom = camera.left / -aspect;
    camera.updateProjectionMatrix();
    cameraBox.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(SCENE_WIDTH*2, SCENE_WIDTH * 2 / aspect, 10));
  }
  renderer.render( scene, camera );
}

for (let i = 0; i < INITIAL_BEES; i++) {
  initBee();
}

renderer.setAnimationLoop( animate );
setInterval(() => {
  if (Math.random() < BEE_CHANCE) {
    initBee();
  }
}, 1000)
