import { config } from '../config';
import { dataPlaneScopeFromSupabaseUrl } from './ppwarm-names';

type ProjectImageScopeConfig = Pick<
  typeof config,
  'SUPABASE_URL' | 'SUPABASE_PUBLIC_URL' | 'INTERNAL_KORTIX_ENV'
>;

/** One authoritative ownership scope for every project-image writer and reaper. */
export function currentProjectImageDataPlaneScope(
  settings: ProjectImageScopeConfig = config,
): string {
  return dataPlaneScopeFromSupabaseUrl(
    settings.SUPABASE_PUBLIC_URL || settings.SUPABASE_URL,
    settings.INTERNAL_KORTIX_ENV,
  );
}
