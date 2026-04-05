#if 	defined(HAS_TransformUVs)
vec2 transformUV(vec2 UV, vec2 scale, mat2 rotation, vec2 offset)
{
	return mul(rotation, UV * scale) + offset;
}
#endif

void    FragmentMain(IN(SFragmentInput) fInput, OUT(SFragmentOutput) fOutput FS_ARGS)
{
	vec4    color = vec4(0,0,0,0);

#if     defined(FINPUT_fragColor)
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
	bool	RGBOnly = GET_CONSTANT(Material, TransformUVs_RGBOnly) != 0;
#endif

#if     defined(HAS_Diffuse)
	color *= SAMPLE(Diffuse_DiffuseMap, fragUV0);
#	if	defined(HAS_TransformUVs)
		if (RGBOnly)
		{
			color.a = SAMPLE(Diffuse_DiffuseMap, oldFragUV0).a;
		}
#	endif
#endif

#if defined(HAS_DiffuseRamp)
	color.rgb = SAMPLE(DiffuseRamp_RampMap, vec2(color.r, 0.0)).rgb;
#endif

#if	defined(HAS_Emissive)
	vec3	emissiveColor1 = SAMPLE(Emissive_EmissiveMap, fragUV0).rgb;	
#if	defined(HAS_EmissiveRamp)
	emissiveColor1 = SAMPLE(EmissiveRamp_RampMap, vec2(emissiveColor1.x,0.0)).rgb;
#endif
	emissiveColor1 *= fInput.fragEmissiveColor;
	color.rgb += emissiveColor1.rgb;
#endif

	// Lit behaviour for transparent meshes isn't defined yet
#if     defined(HAS_AlphaRemap)
	vec2    alphaTexCoord = vec2(color.a, fInput.fragCursor);
	color.a = SAMPLE(AlphaRemap_AlphaMap, alphaTexCoord).r;
#endif
	fOutput.Output0 = color;
}
