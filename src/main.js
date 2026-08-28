import './styles/base.css';
import './styles/editor.css';
import './styles/layout.css';
import './styles/sprint2-polish.css';
import './styles/sprint1-9.css';
import './styles/author-studio-2.css';
import '../styles/settings-and-toolbar.css';
import { initApp } from './app.js';
import { installStabilityLayer } from './stability.js';
import { installRequestedFixes } from './requested-fixes.js';

initApp();
installStabilityLayer();
installRequestedFixes();
