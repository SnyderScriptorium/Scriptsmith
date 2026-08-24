import './styles/base.css';
import './styles/editor.css';
import './styles/layout.css';
import './styles/sprint2-polish.css';
import './styles/sprint1-9.css';
import { initApp } from './app.js';
import { installSprint19 } from './sprint1-9.js';
import { installTimelineInteractions } from './timeline-interactions.js';
import './sprint2-polish.js';

initApp();
installSprint19();
installTimelineInteractions();
