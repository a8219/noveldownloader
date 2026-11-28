// Material Color Utilities by Google LLC, Apache-2.0.
// Build with @material/material-color-utilities and esbuild; see workers/README.md.
import {themeFromSourceColor, argbFromHex, hexFromArgb} from '@material/material-color-utilities';
export function palette(seed, dark) {
  const theme = themeFromSourceColor(argbFromHex(seed));
  const roles = (dark ? theme.schemes.dark : theme.schemes.light).toJSON();
  return Object.fromEntries(Object.entries(roles).map(([name, color]) => [
    name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase()), hexFromArgb(color)
  ]));
}
