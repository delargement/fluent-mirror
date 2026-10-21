import { createRoot } from 'react-dom/client';
import FluentMirror from '../components/fluent-mirror';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(<FluentMirror demoOnly />);
