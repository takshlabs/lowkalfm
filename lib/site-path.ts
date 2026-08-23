const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const isProjectDeployment = basePath.length > 0;

export function sitePath(path: string) {
  return `${basePath}${path}`;
}
