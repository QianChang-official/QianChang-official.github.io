import { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { staticPictures } from '@/lib/staticData';
import { X, Camera, Clock } from 'lucide-react';

interface GalleryImage {
  id: number;
  pictureAddress: string | null;
  pictureName: string | null;
  pictureDescription: string | null;
  pictureTime: string | null;
}

export default function Gallery() {
  const { t } = useLanguage();
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  const pictures = staticPictures;
  const isLoading = false;

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="section-title text-[var(--flux-ink)] mb-4">
          <span className="gold-gradient-text">{t('gallery.title')}</span>
        </h1>
        <p className="text-[var(--flux-ink-light)] max-w-xl mx-auto">
          {t('gallery.description')}
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-[var(--flux-ink-light)]">{t('common.loading')}</div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          {pictures?.map((pic) => (
            <div
              key={pic.id}
              className="group relative break-inside-avoid rounded-xl overflow-hidden cursor-pointer"
              onClick={() => setSelectedImage(pic)}
            >
              <img
                src={pic.pictureAddress ?? undefined}
                alt={pic.pictureName ?? undefined}
                className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--flux-marble)]/90 via-[var(--flux-marble)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-5">
                {pic.pictureName && (
                  <h3 className="text-lg font-semibold text-[var(--flux-ink)] mb-1">{pic.pictureName}</h3>
                )}
                {pic.pictureDescription && (
                  <p className="text-sm text-[var(--flux-ink-light)] mb-2">{pic.pictureDescription}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-[var(--flux-ink-light)]">
                  {pic.pictureTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {pic.pictureTime}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[10000] bg-[var(--flux-marble)]/95 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-6 right-6 p-2 rounded-full bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink-light)] hover:text-[var(--flux-ink)] transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="max-w-5xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage.pictureAddress ?? undefined}
              alt={selectedImage.pictureName ?? undefined}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
            <div className="mt-4 text-center">
              {selectedImage.pictureName && (
                <h3 className="text-xl font-semibold text-[var(--flux-ink)]">{selectedImage.pictureName}</h3>
              )}
              {selectedImage.pictureDescription && (
                <p className="text-sm text-[var(--flux-ink-light)] mt-1">{selectedImage.pictureDescription}</p>
              )}
              {selectedImage.pictureTime && (
                <p className="text-xs text-[var(--flux-ink-light)] mt-2 flex items-center justify-center gap-1">
                  <Camera className="w-3 h-3" />
                  {selectedImage.pictureTime}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
