export type MediaCategoryImage = {
  src: string;
  alt: string;
};

const CATEGORY_IMAGES: Record<string, MediaCategoryImage> = {
  SPOT: {
    src: '/images/broadcast-camera.jpg',
    alt: 'Caméra de télévision professionnelle installée sur le terrain.',
  },
  PARRAINAGE: {
    src: '/images/broadcast-control-room.jpg',
    alt: 'Régie audiovisuelle avec plusieurs écrans de diffusion.',
  },
  HABILLAGE: {
    src: '/images/news-studio.jpg',
    alt: 'Plateau de journal télévisé équipé de caméras et d’éclairages.',
  },
  AUTRE: {
    src: '/images/broadcast-control-room.jpg',
    alt: 'Régie audiovisuelle avec plusieurs écrans de diffusion.',
  },
};

export function mediaImageForCategory(category: string): MediaCategoryImage {
  return CATEGORY_IMAGES[category] ?? CATEGORY_IMAGES.AUTRE;
}
