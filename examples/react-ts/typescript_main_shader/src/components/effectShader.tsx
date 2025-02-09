import { GlslPipelineReact, useGlslPipeline } from 'glsl-pipeline/r3f'
import { useMemo, useRef, useCallback } from 'react'
import { resolveLygia } from 'resolve-lygia'
import { useThree } from '@react-three/fiber'
import { GlslPipelineClass, isPerspectiveCamera } from 'glsl-pipeline/types';

export default function GlslViewer() {

    const shader = useRef<GlslPipelineClass | null>(null);

    const setFov = useCallback((height: number, distance: number) => {
        return 2 * Math.atan((height / 2) / distance) * (180 / Math.PI);
    }, [])

    const { size, camera } = useThree();

    useMemo(() => {
        if(isPerspectiveCamera(camera)) {
            camera.fov = setFov(size.height, camera.position.z);
        }
    }, [size, camera, setFov]);

    const fragment = useMemo(() => resolveLygia(/* glsl */`
        uniform sampler2D   u_buffer0; // 256x256
        uniform sampler2D   u_buffer1; // 256x256


        uniform vec4        u_date;
        uniform vec2        u_resolution;
        uniform float       u_time;

        #include "lygia/math/const.glsl"
        #include "lygia/math/decimate.glsl"
        #include "lygia/space/ratio.glsl"
        #include "lygia/space/scale.glsl"

        #define DIGITS_SIZE vec2(0.1)
        #define DIGITS_LEADING_INT 2.0
        #include "lygia/draw/digits.glsl"

        #include "lygia/sample/clamp2edge.glsl"
        #include "lygia/filter/gaussianBlur/1D_fast13.glsl"

        #include "lygia/space/sqTile.glsl"
        #include "lygia/draw/circle.glsl"

        void main() {
            vec3 color = vec3(0.0);
            vec2 pixel = 1.0/u_resolution.xy;
            vec2 st = gl_FragCoord.xy * pixel;
            vec2 sst = ratio(st, u_resolution);
            
            #ifdef BUFFER_0
            // Draw the digital clock

            sst = scale(sst, 0.5);
            float h = floor( u_date.w / 3600.0);
            float m = floor( mod(u_date.w, 3600.0) / 60.0 );
            float time = 0.0;

            // blinking :
            color +=  (circle(sst - vec2(0.0, 0.025), 0.02) + 
                      circle(sst + vec2(0.0, 0.025), 0.02)) * 
                      mod(floor(u_time), 2.0);

            sst -= vec2(0.3, 0.45);
            // Hr and Min
            color += digits(sst, h, 0.0, 1.0);
            color += digits(sst - vec2(0.23, 0.0), m, 0.0, 1.0);
            color *= vec3(0.5, 1.0, 0.9);

            
            #elif defined(BUFFER_1)
            // First pass blur 
            color = gaussianBlur1D_fast13(u_buffer0, st, vec2(1.0, 0.0) * pixel).rgb; 
            
            #else
            // Second pass blur
            vec3 blur = gaussianBlur1D_fast13(u_buffer1, sst, 1.0/vec2(0.0, 512.0)).rgb;
            
            // sample the fist buffer but using a dot matrix
            float s = 80.0;
            vec4 t = sqTile(sst * s * 2.0 + 0.5);
            vec3 value = sampleClamp2edge(u_buffer0, decimate(sst, s) - pixel).rgb;

            // Draw pixels + glow
            color += value * fill(circleSDF(t.xy), 0.5, 0.5) * 0.8;
            color *= sin(st.y * u_resolution.y * 0.25 - u_time * 5.0) * 0.25 + 0.75;
            color += blur;


            #endif

            gl_FragColor = vec4(color, 1.);
        }`), []);

    useGlslPipeline(({ resolution, id, uniforms }) => {
        console.log(resolution, id, uniforms.u_resolution.value);
    }, shader);

    return <GlslPipelineReact ref={shader} type={'main'} fragmentShader={fragment} />
}