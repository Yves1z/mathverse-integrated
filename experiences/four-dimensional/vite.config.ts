import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {ARTIFACT_ALIASES} from './src/projectCatalog.ts';

export default defineConfig({
  plugins: [react(),{
    name:'mathverse-gallery-compatibility',
    configureServer(server){server.middlewares.use((req,res,next)=>{
      const url=req.url??'',i=url.indexOf('?'),pathname=i<0?url:url.slice(0,i),query=i<0?'':url.slice(i);
      const match=Object.keys(ARTIFACT_ALIASES).find(old=>pathname===old||pathname.startsWith(old+'/'));
      if(!match){next();return;}res.statusCode=307;res.setHeader('Location',ARTIFACT_ALIASES[match]+pathname.slice(match.length)+query);res.end();
    });},
  }],
  server: { host: '127.0.0.1', port: 5184, strictPort: true },
  preview: { host: '127.0.0.1', port: 5185, strictPort: true },
});
