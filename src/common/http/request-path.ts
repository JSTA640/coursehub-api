// Ruta sin query string: la query puede contener términos de búsqueda u otros datos
// que no deben acabar en registros ni en respuestas de error.
export function pathWithoutQuery(url: string): string {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}
