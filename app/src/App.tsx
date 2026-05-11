import { Routes, Route } from 'react-router';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import Home from './pages/Home';
import Blog from './pages/Blog';
import BlogDetail from './pages/BlogDetail';
import Timeline from './pages/Timeline';
import Gallery from './pages/Gallery';
import Messages from './pages/Messages';
import Friends from './pages/Friends';
import About from './pages/About';
import Admin from './pages/Admin';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import DifferentialSurround from './pages/DifferentialSurround';
import MusicPlayer from './components/MusicPlayer';

export default function App() {
  return (
    <>
      <Navigation />
      <main className="relative z-10 min-h-screen marble-bg">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:id" element={<BlogDetail />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/about" element={<About />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/login" element={<Login />} />
          <Route path="/surround" element={<DifferentialSurround />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <MusicPlayer />
    </>
  );
}
