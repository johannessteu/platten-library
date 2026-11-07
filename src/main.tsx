import { render } from 'preact';
import '@fontsource-variable/figtree';
import './styles.css';
import { App } from './App.tsx';

render(<App />, document.getElementById('app')!);
