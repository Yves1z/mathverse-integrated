import {extend,type ThreeElement} from '@react-three/fiber';
import {Line} from 'three';
extend({WorldLine:Line});
declare module '@react-three/fiber'{interface ThreeElements{worldLine:ThreeElement<typeof Line>}}
