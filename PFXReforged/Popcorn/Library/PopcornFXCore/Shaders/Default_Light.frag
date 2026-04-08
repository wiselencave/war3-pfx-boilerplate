
vec3    DepthToWorldPos(float pDepthValue, vec2 pUv, mat4 pInvViewProj)
{
	vec2    clipSpace = pUv * 2 - 1;
	vec4    projPos = vec4(clipSpace, pDepthValue, 1);
	projPos = mul(pInvViewProj, projPos);
	return projPos.xyz / projPos.w;
}

vec3    UnpackNormalSpheremap(vec2 normal)
{
	vec4    nn = vec4(normal * 2 - 1, 1, -1);
	float   l = dot(nn.xyz, -nn.xyw);
	nn.z = l;
	nn.xy *= sqrt(l);
	return nn.xyz * 2 + vec3(0, 0, -1);
}

vec3    UnpackNormalStd(vec3 normal)
{
	return normal * 2 - 1;
}

// Julien's fall-off function:
// The constants A and B should be computed on CPU and passed as constants to the shader
//------------------------------
// k = 1.0 / steepness
// x = normalized distance
//------------------------------
//  float A = 1 / pow(k + 1, 2);
//  float B = 1 - A;
//  float C = 1 / pow(x * k + 1, 2);
//  return (C - A) / B;
//------------------------------
float   unlinearizeFalloff(float x FS_ARGS)
{
	float k = 1 / (GET_CONSTANT(Material, LightAttenuation_AttenuationSteepness) + 1.0e-3f);
	float A = 1 / ((k + 1) * (k + 1));
	float B = 1 - A;
	float C = 1 / ((x * k + 1) * (x * k + 1));
	return (C - A) / B;
}

//------------------------------
// BRDF Computation
//------------------------------
#define PI                      3.141592f
#define METAL_FRESNEL_FACTOR    vec3(0.04f, 0.04f, 0.04f)
#define EPSILON                 1.0e-5f

#if     HAS_SphereLight // Experimental area-light

float normalDistFuncGGX(float cosLh, float roughness, float normFactor)
{
	float alpha   = roughness * roughness;
	float alphaSq = alpha * alpha;

	float denom = (cosLh * cosLh) * (alphaSq - 1) + 1;
	return (normFactor * alpha) / (PI * denom * denom);
}

#else

float   normalDistFuncGGX(float cosLh, float roughness)
{
	float alpha   = roughness * roughness;
	float alphaSq = alpha * alpha;

	float denom = (cosLh * cosLh) * (alphaSq - 1) + 1;
	return alphaSq / (PI * denom * denom);
}

#endif

float   schlickGGX(float cosLi, float cosLo, float roughness)
{
	float r = roughness + 1;
	float k = (r * r) / 8; // UE4 remapping

	float t1 = cosLi / (cosLi * (1 - k) + k);
	float t2 = cosLo / (cosLo * (1 - k) + k);

	return t1 * t2;
}

vec3    fresnelSchlick(vec3 surfaceMetalColor, float cosTheta)
{
	return surfaceMetalColor + (vec3(1, 1, 1) - surfaceMetalColor) * pow(1 - cosTheta, 5.0f);
}

#if     HAS_SphereLight // Experimental area-light

vec3 computeBRDF(vec3 surfToLightSurf, vec3 surfToLightCenter, vec3 surfToView, vec3 surfaceNormal, float roughness, float metalness, vec3 surfaceColor, float normFactor)
{
	vec3    halfVec = normalize(surfToLightSurf + surfToView);

	float   NoL = max(0.0f, dot(surfToLightCenter, surfaceNormal));
	float   specIntensity = max(0.0f, dot(halfVec, surfaceNormal));
	float   NoV = max(EPSILON, dot(surfToView, surfaceNormal)); // Weird behavior when this is near 0

	vec3    surfaceMetalColor = mix(METAL_FRESNEL_FACTOR, surfaceColor, metalness);

	vec3    F  = fresnelSchlick(surfaceMetalColor, max(0.0f, dot(halfVec, surfToView)));
	float   D = normalDistFuncGGX(specIntensity, roughness, normFactor);
	float   G = schlickGGX(NoL, NoV, roughness);

	vec3    diffuseBRDF = mix(vec3(1, 1, 1) - F, vec3(0, 0, 0), metalness) * surfaceColor;
	vec3    specularBRDF = (F * D * G) / max(EPSILON, 4 * NoL * NoV);

	return (diffuseBRDF + specularBRDF) * NoL;
}

#else

vec3 computeBRDF(vec3 surfToLight, vec3 surfToView, vec3 surfaceNormal, float roughness, float metalness, vec3 surfaceColor)
{
	vec3    halfVec = normalize(surfToLight + surfToView);

	float   NoL = max(0.0f, dot(surfToLight, surfaceNormal));
	float   specIntensity = max(0.0f, dot(halfVec, surfaceNormal));
	float   NoV = max(EPSILON, dot(surfToView, surfaceNormal)); // Weird behavior when this is near 0

	vec3    surfaceMetalColor = mix(METAL_FRESNEL_FACTOR, surfaceColor, metalness);
	
	vec3    F  = fresnelSchlick(surfaceMetalColor, max(0.0f, dot(halfVec, surfToView)));
	float   D = normalDistFuncGGX(specIntensity, roughness);
	float   G = schlickGGX(NoL, NoV, roughness);

	vec3 diffuseBRDF = mix(vec3(1, 1, 1) - F, vec3(0, 0, 0), metalness) * surfaceColor;
	vec3 specularBRDF = (F * D * G) / max(EPSILON, 4 * NoL * NoV);

	return (diffuseBRDF + specularBRDF) * NoL;
}

#endif

vec3        nearestReflectedSpherePoint(vec3 surfToLight, vec3 viewToSurf, vec3 surfaceNormal, float lightSphereRadius)
{
	vec3    reflected = reflect(normalize(viewToSurf), normalize(surfaceNormal));
	vec3    centerToRay = dot(surfToLight, reflected) * reflected - surfToLight;
	float   squareRad = lightSphereRadius * lightSphereRadius;

	return normalize(surfToLight + centerToRay * clamp(lightSphereRadius / length(centerToRay), 0.0f, 1.0f));
}

void        FragmentMain(IN(SFragmentInput) fInput, OUT(SFragmentOutput) fOutput FS_ARGS)
{
	vec3    lightPosition = fInput.fragLightPosition;
	float   lightRange = fInput.fragRange;
	vec3    lightColor = fInput.fragColor.xyz;
	mat4    invViewProj = GET_CONSTANT(SceneInfo, InvViewProj);
	mat4    invView = GET_CONSTANT(SceneInfo, InvView);
	vec3    viewPosition = GET_MATRIX_W_AXIS(GET_CONSTANT(SceneInfo, InvView_FrameRhYUp)).xyz;
	vec2    screenTexCoord = fInput.fragViewProjPosition.xy / fInput.fragViewProjPosition.w * 0.5f + 0.5f;

	vec3    surfaceColor = SAMPLE(DiffuseSampler, screenTexCoord).rgb;
	float   depthValue = SAMPLE(DepthSampler, screenTexCoord).r;
	vec3    surfacePosition = DepthToWorldPos(depthValue, screenTexCoord, invViewProj);
	vec4    packedNormalRoughMetal = SAMPLE(NormalRoughMetalSampler, screenTexCoord);
	vec3    viewSpaceNormal = UnpackNormalSpheremap(packedNormalRoughMetal.rg);
	vec3    surfaceNormal = mul(invView, vec4(viewSpaceNormal, 0.0f)).xyz;
	float   surfaceRoughness = max(0.01f, packedNormalRoughMetal.z);
	float   surfaceMetalness = max(0.01f, packedNormalRoughMetal.w);

	vec3    surfToLight = lightPosition - surfacePosition;
	vec3    surfToView = viewPosition - surfacePosition;
	vec3    surfToLightDir = normalize(surfToLight);
	vec3    surfToViewDir = normalize(surfToView);

#if     HAS_SphereLight // Experimental area-light

	float   lightSphereRadius = fInput.fragSphereRadius;

	vec3    adjustedSurfToLight = nearestReflectedSpherePoint(surfToLight, surfToView, surfaceNormal, lightSphereRadius);
	
	float   lightDist = length(surfToLight);
	float   alpha = surfaceRoughness * surfaceRoughness;
	float   alphaPrime = clamp(lightSphereRadius / (lightDist * 2) + alpha, 0.0f, 1.0f);
	
	vec3    lightContrib = computeBRDF( adjustedSurfToLight,
										surfToLightDir,
										surfToViewDir,
										surfaceNormal,
										surfaceRoughness,
										surfaceMetalness,
										surfaceColor,
										alphaPrime);

	// Compute the light attenuation:
	float   distToLight = max(0.0f, length(surfToLight) - lightSphereRadius);
	float   normalizedDistanceToLight = min(1.0f, (distToLight / lightRange));
	float   lightAttenuation = unlinearizeFalloff(normalizedDistanceToLight FS_PARAMS);
	fOutput.Output0 = vec4(lightContrib * lightAttenuation * lightColor, 0.0f);

#else

	vec3    lightDiffuse = computeBRDF( surfToLightDir,
										surfToViewDir,
										surfaceNormal,
										surfaceRoughness,
										surfaceMetalness,
										surfaceColor);

	// Compute the light attenuation:
	vec3    worldPosToLight = lightPosition - surfacePosition;
	float   normalizedDistanceToLight = min(1.0f, length(worldPosToLight) / lightRange);
	float   lightAttenuation = unlinearizeFalloff(normalizedDistanceToLight FS_PARAMS);

	fOutput.Output0 = vec4(lightDiffuse * lightAttenuation * lightColor, 0.0f);

#endif
}
