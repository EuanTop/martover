import React, { forwardRef, useMemo } from 'react';
import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';

const fragmentShader = `
uniform float sharpness;
uniform float contrast;

void mainImage(
  const in vec4 inputColor,
  const in vec2 uv,
  out vec4 outputColor
) {
  vec3 north = texture2D(
    inputBuffer,
    uv + vec2(0.0, texelSize.y)
  ).rgb;
  vec3 south = texture2D(
    inputBuffer,
    uv - vec2(0.0, texelSize.y)
  ).rgb;
  vec3 east = texture2D(
    inputBuffer,
    uv + vec2(texelSize.x, 0.0)
  ).rgb;
  vec3 west = texture2D(
    inputBuffer,
    uv - vec2(texelSize.x, 0.0)
  ).rgb;
  vec3 northEast = texture2D(
    inputBuffer,
    uv + vec2(texelSize.x, texelSize.y)
  ).rgb;
  vec3 northWest = texture2D(
    inputBuffer,
    uv + vec2(-texelSize.x, texelSize.y)
  ).rgb;
  vec3 southEast = texture2D(
    inputBuffer,
    uv + vec2(texelSize.x, -texelSize.y)
  ).rgb;
  vec3 southWest = texture2D(
    inputBuffer,
    uv + vec2(-texelSize.x, -texelSize.y)
  ).rgb;
  vec3 localMean = (north + south + east + west) * 0.25;
  vec3 diagonalMean = (
    northEast + northWest + southEast + southWest
  ) * 0.25;
  vec3 neighborhoodMean = mix(localMean, diagonalMean, 0.35);

  float luminance = dot(inputColor.rgb, vec3(0.299, 0.587, 0.114));
  float neighborhoodLuminance = dot(
    neighborhoodMean.rgb,
    vec3(0.299, 0.587, 0.114)
  );
  float terrainMask = smoothstep(0.02, 0.22, luminance)
    * (1.0 - smoothstep(0.78, 0.98, luminance));
  float luminanceDetail = luminance - neighborhoodLuminance;
  float edgeMask = smoothstep(0.004, 0.08, abs(luminanceDetail));
  float restoredLuminance = luminance
    + luminanceDetail * sharpness * terrainMask
    + luminanceDetail * contrast * edgeMask * terrainMask;
  vec3 restored = inputColor.rgb
    + (restoredLuminance - luminance);
  outputColor = vec4(clamp(restored, 0.0, 1.0), inputColor.a);
}
`;

class CraterSurfaceEffect extends Effect {
  constructor({ sharpness = 1, contrast = 0.05 } = {}) {
    super('CraterSurfaceEffect', fragmentShader, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['sharpness', new Uniform(sharpness)],
        ['contrast', new Uniform(contrast)],
      ]),
    });
  }
}

const CraterViewEffects = forwardRef((props, ref) => {
  const effect = useMemo(
    () => new CraterSurfaceEffect(props),
    [props.contrast, props.sharpness]
  );

  return <primitive ref={ref} object={effect} />;
});

CraterViewEffects.displayName = 'CraterViewEffects';

export default CraterViewEffects;
