import './snap-sheet.css';
import { SnapSheet } from './snap-sheet.js';

export { SnapSheet };
export default SnapSheet;

if (!new URL(import.meta.url).searchParams.has('define', 'false')) {
  SnapSheet.define();
}
