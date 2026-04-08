vec2    PackNormalSpheremap(vec3 normal)
{
	normal = normalize(normal);
	const float eps = 0.0001f;
	float lxy = length(normal.xy) + eps; // We add epsilon to avoid NANs
	return normal.xy / lxy * sqrt(-(normal.z) * 0.5 + 0.5) * 0.5 + 0.5;
}

#if 	defined(HAS_TransformUVs)
vec2 transformUV(vec2 UV, vec2 scale, mat2 rotation, vec2 offset)
{
	return mul(rotation, UV * scale) + offset;
}
#endif

void    FragmentMain(IN(SFragmentInput) fInput, OUT(SFragmentOutput) fOutput FS_ARGS)
{
	float   roughness = 1.0f;
	float   metalness = 1.0f;
	vec3    normal = fInput.fragNormal;
	vec4    color = vec4(0,0,0,0);
	vec4    emissive = vec4(0,0,0,0);

#if	    defined(FINPUT_fragColor)
	color = fInput.fragColor;
#else
	color = vec4(1.0f, 1.0f, 1.0f, 0.1f);
#endif

vec2 fragUV0 = fInput.fragUV0;
#if		defined(HAS_TransformUVs)
	float	sinR = sin(fInput.fragUVRotate);
	float	cosR = cos(fInput.fragUVRotate);
	mat2	UVRotation = mat2(cosR, sinR, -sinR, cosR);
	vec2	UVScale = fInput.fragUVScale;
	vec2	UVOffset = fInput.fragUVOffset;
	vec2	oldFragUV0 = fragUV0;	
	fragUV0 = transformUV(fragUV0, UVScale, UVRotation, UVOffset); // scale then rotate then translate UV
	fragUV0 = fract(fragUV0);
#endif

#if     defined(HAS_Diffuse)
	color *= SAMPLE(Diffuse_DiffuseMap, fragUV0);
#	if	defined(HAS_TransformUVs)
		bool	RGBOnly = GET_CONSTANT(Material, TransformUVs_RGBOnly) != 0;
		if (RGBOnly)
		{
			color.a = SAMPLE(Diffuse_DiffuseMap, oldFragUV0).a;
		}
#	endif
#endif

#if     defined(HAS_AlphaRemap)
    vec2    alphaTexCoord = vec2(color.a, fInput.fragCursor);
    color.a = SAMPLE(AlphaRemap_AlphaMap, alphaTexCoord).r;
#endif

#if	defined(HAS_Opaque)
    if (GET_CONSTANT(Material, Opaque_Type) == 1 &&
		color.a < GET_CONSTANT(Material, Opaque_MaskThreshold))
        discard;
#endif

#if defined(HAS_DiffuseRamp)
	color.rgb = SAMPLE(DiffuseRamp_RampMap, vec2(color.r, 0.0)).rgb;
#endif

#if     defined(HAS_Lit)

	vec3    normalTex =  SAMPLE(Lit_NormalMap, fragUV0).xyz;

	normalTex = 2.0f * normalTex.xyz - vec3(1.0f, 1.0f, 1.0f);
	
// if uv are rotated, inverse rotate the billboard space normal
// to cancel tangent-UV mismatch
#	if	defined(HAS_TransformUVs)
		float sinMR = -sinR; // sin(-rot) = -sin(rot)
		float cosMR = cosR; // cos(-rot) = cos(rot)
		mat2 UVInverseRotation = mat2(cosMR, sinMR, -sinMR, cosMR);
		normalTex.xy = mul(UVInverseRotation, normalTex.xy);
#	endif

	vec3    T = normalize(fInput.fragTangent.xyz);
	vec3    N = normalize(fInput.fragNormal.xyz);
	vec3    B = CROSS(N, T) * fInput.fragTangent.w;
	N = fInput.IsFrontFace ? N : -N;
	mat3    TBN = BUILD_MAT3(T, B, N);

	normal = mul(TBN, normalTex);

	vec2    roughMetal = SAMPLE(Lit_RoughMetalMap, fragUV0).xy;

	roughness = GET_CONSTANT(Material, Lit_Roughness);
	roughness *= roughMetal.x;
	metalness = GET_CONSTANT(Material, Lit_Metalness);
	metalness *= roughMetal.y;

#elif   defined(HAS_LegacyLit)

	vec3    normalTex =  SAMPLE(LegacyLit_NormalMap, fragUV0).xyz;
	normalTex = 2.0f * normalTex.xyz - vec3(1.0f, 1.0f, 1.0f);
	
#	if	defined(HAS_TransformUVs)
		float sinMR = -sinR; // sin(-rot) = -sin(rot)
		float cosMR = cosR; // cos(-rot) = cos(rot)
		mat2 UVInverseRotation = mat2(cosMR, sinMR, -sinMR, cosMR);
		normalTex.xy = mul(UVInverseRotation, normalTex.xy);
#	endif
	
	vec3    T = normalize(fInput.fragTangent.xyz);
	vec3    N = normalize(fInput.fragNormal.xyz);
	vec3    B = CROSS(N, T) * fInput.fragTangent.w;
	N = fInput.IsFrontFace ? N : -N;
	mat3    TBN = BUILD_MAT3(T, B, N);
	normal = mul(TBN, normalTex);

	// In the old lighting feature, we stored the specular and glossiness in the specular map.
	// To mimic something similar, we juste set the roughness to (1.0 - specularValue) * 0.7 + 0.3 to avoid very sharp specular which did not exist before
	// The metalness is always 0.
	roughness = (1.0 - SAMPLE(LegacyLit_SpecularMap, fragUV0).x) * 0.7 + 0.3;
	metalness = 0.0f;

#else

	emissive = color;
	color = vec4(0,0,0,0);

#endif

#if defined(HAS_Emissive)

	vec3 emissiveColor1 = SAMPLE(Emissive_EmissiveMap, fragUV0).rgb;	
	#if defined(HAS_EmissiveRamp)
		emissiveColor1 = SAMPLE(EmissiveRamp_RampMap, vec2(emissiveColor1.x,0.0)).rgb;
	#endif
	emissive.rgb += emissiveColor1 * fInput.fragEmissiveColor;

#endif

	vec4    normalSpec;
	normalSpec = vec4(PackNormalSpheremap(normal), roughness, metalness);

	fOutput.Output0 = color;
	fOutput.Output1 = fInput.fragViewProjPosition.z / fInput.fragViewProjPosition.w;
	fOutput.Output2 = emissive;
	fOutput.Output3 = normalSpec;
}
