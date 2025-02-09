import * as React from 'react'

import {
    useFrame,
    useThree
} from "@react-three/fiber"

import {
    GlslPipeline
} from "../../index"

import {
    GlslPipelineContext
} from "../hooks"

import {
    ShaderMaterial
} from 'three'

import { addCallback, callbacks, removeCallback, isPerspectiveCamera, GlslPipelineClass, GlslPipelineProperties, callbackRender, MaterialConstructor, PipelineReactParams } from '../../types';

export const GlslPipelineReact = /* @__PURE__ */ React.memo(React.forwardRef(<T extends MaterialConstructor>(
    { 
        type = "scene", 
        uniforms, 
        fragmentShader, 
        vertexShader, 
        branch, 
        resize = true, 
        autoRender = true, 
        renderPriority = 0,
        ...props
    } : PipelineReactParams<T>, 
        ref: React.Ref<GlslPipelineClass>
    ) => {

    const { gl, camera, size } = useThree();

    const callbacks = React.useRef<callbacks[]>([]);

    const addCallback = React.useCallback<addCallback>((callback, priority, pipeline) => {
        callbacks.current.push({ callback, priority, pipeline });
        callbacks.current.sort((a, b) => a.priority - b.priority);
    }, []);

    const removeCallback = React.useCallback<removeCallback>((callback) => {
        callbacks.current = callbacks.current.filter((cb) => cb.callback !== callback)
    }, []);

    const filtered = React.useCallback<(pipe: GlslPipelineClass) => GlslPipelineProperties>((pipe) => {
        return (Object.keys(pipe) as Array<keyof typeof GlslPipeline>).reduce((res, key) => {
            if (typeof pipe[key as keyof GlslPipelineClass] !== 'function') {
                res[key] = pipe[key as keyof GlslPipelineClass];
            }

            return res;
        }, {} as any);
    }, []);

    const onRender = React.useCallback<callbackRender>((s) => {
        for (let i = 0; i < callbacks.current.length; i++) {
            callbacks.current[i].callback(filtered(callbacks.current[i].pipeline), s);
        }
    }, []);

    const pipeline = React.useMemo(() => {
        // Apply the same glsl if ref given the same glsl-pipeline reference
        let glsl: GlslPipelineClass;

        // Check if ref.current exists and instance of GlslPipeline class
        if (ref && (ref as React.RefObject<GlslPipelineClass>).current instanceof GlslPipeline) {

            // Assign to existing GlslPipeline
            glsl = (ref as React.RefObject<GlslPipelineClass>).current as GlslPipelineClass;

            // Apply uniforms if exists
            if (uniforms) {
                glsl.uniforms = uniforms;
            }

            // Apply options if any
            if (props) {
                glsl.options = props;
            }

        } else {
            // Else initialized new GlslPipeline
            glsl = new GlslPipeline(gl, uniforms, props);
        }

        glsl.load(fragmentShader, vertexShader);

        return glsl;
    }, [fragmentShader, vertexShader, gl, uniforms, props]);

    useFrame((state) => {
        if (autoRender) {
            switch (type) {
                case "scene":
                    pipeline.renderScene(state.scene, state.camera);
                    break;

                case "main":
                    pipeline.renderMain();
                    break;
            }
        }
        onRender(state);
    }, renderPriority);

    React.useEffect(() => {
        if (pipeline) {
            GlslPipelineContext.setState({ addCallback, removeCallback });
        }
    }, [addCallback, removeCallback]);

    const material = React.useMemo(() => branch ? pipeline.branchMaterial(branch) : pipeline.material, [pipeline, branch]);

    React.useImperativeHandle(ref, () => pipeline, [pipeline]);

    const onResize = React.useCallback(() => {

        if(!type) return;

        gl.setPixelRatio(window.devicePixelRatio);
        gl.setSize(size.width, size.height);
        pipeline.setSize(size.width, size.height);

        // Only set camera manually if camera set to `manual` because fiber is making the camera responsive by default.
        if (type === 'scene' && isPerspectiveCamera(camera)) {
            camera.aspect = size.width / size.height;
            camera.updateProjectionMatrix();
        }

    }, [pipeline, type, size, camera, gl]);

    React.useLayoutEffect(() => {
        if (resize) {
            window.addEventListener('resize', onResize, false);
            onResize();
        }

        return () => {
            if (resize) {
                window.removeEventListener('resize', onResize, false);
            }
            pipeline.dispose();
        }
    }, [resize, onResize, pipeline]);

    return (
        <>
            {
                type === 'scene' ? <primitive ref={ref} attach='material' object={material as ShaderMaterial} /> : type === 'main' &&
                <mesh>
                    <planeGeometry args={[2, 2]} />
                    <primitive ref={ref} attach='material' object={material as ShaderMaterial} />
                </mesh>
            }
        </>
    )
}));

// For React Dev Tools Display Name
GlslPipelineReact.displayName = 'GlslPipelineReact'