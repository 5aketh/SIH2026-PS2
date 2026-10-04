import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useWizard } from '../context/WizardContext';
import { LANDING_CATEGORY_MAP } from '../data/wizard';
import { nameFromDescription } from '../lib/wizardModel';

/**
 * Connects the landing page's integration events (services/packwise.js) to
 * the wizard: a category card opens commodity search filtered to that
 * category, and the custom form starts a custom commodity.
 */
export default function PackWiseBridge() {
  const navigate = useNavigate();
  const { startCustom } = useWizard();

  useEffect(() => {
    function onCategory(e) {
      const category = LANDING_CATEGORY_MAP[e.detail.category];
      navigate('/analyze/food' + (category ? '?category=' + category : ''));
    }
    function onCustom(e) {
      const { description, tags } = e.detail;
      startCustom({ name: nameFromDescription(description), notes: { description, tags } });
      navigate('/analyze/food');
    }
    document.addEventListener('packwise:start-category', onCategory);
    document.addEventListener('packwise:start-custom', onCustom);
    return () => {
      document.removeEventListener('packwise:start-category', onCategory);
      document.removeEventListener('packwise:start-custom', onCustom);
    };
  }, [navigate, startCustom]);

  return null;
}
