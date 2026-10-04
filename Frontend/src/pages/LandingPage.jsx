import { UnpackProvider } from '../context/UnpackContext';
import SkipLink from '../components/SkipLink';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Pipeline from '../components/Pipeline';
import CustomPackaging from '../components/CustomPackaging';
import ToolsSection from '../components/ToolsSection';
import Footer from '../components/Footer';

export default function LandingPage() {
  return (
    <UnpackProvider>
      <SkipLink />
      <Navbar />
      <main id="main">
        <Hero />
        <Pipeline />
        <CustomPackaging />
        <ToolsSection />
      </main>
      <Footer />
    </UnpackProvider>
  );
}
