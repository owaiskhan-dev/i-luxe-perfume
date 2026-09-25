import controlleImg from "../assets/controlle.jpeg";
import controlle30 from "../assets/controlle-30ml.jpeg";
import controlleTesterImg from "../assets/controlle-tester.jpeg";
import falconOneImg from "../assets/falcon-one.jpeg";
import falconOne30 from "../assets/falcon-one-30ml.jpeg";
import falconOneTesterImg from "../assets/falcon-one-tester.jpeg";
import masaraiImg from "../assets/masarai.jpeg";
import masarai30 from "../assets/masarai-30ml.jpeg";
import masaraiTesterImg from "../assets/masarai-tester.jpeg";
import meadowsImg from "../assets/meadows.jpeg";
import meadows30 from "../assets/meadows-30ml.jpeg";
import meadowsTesterImg from "../assets/meadows-tester.jpeg";
import luxeReverieImg from "../assets/luxe-reverie-1300.jpeg";
import luxeReverie30 from "../assets/background-eight-and-luxe-reverie-30ml.jpeg";
import luxeReverieTesterImg from "../assets/luxe-reverie-tester.jpeg";

export const CURRENCY = "PKR";

export const formatPrice = (amount, withCurrency = true) => {
  const formatted = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return withCurrency ? `${CURRENCY} ${formatted}` : formatted;
};

/* The provided asset images are the source of truth for the product library.
   Each perfume ships as a flagship bottle (primary image) and is also
   available in a 30ml size (additional gallery image). */
export const perfumes = [
  {
    id: "controlle",
    name: "Controlle",
    family: "Controlle",
    category: "controlle",
    badge: "Sale",
    description:
      "A commanding signature composed for those who lead quietly. Polished, assured and impossible to forget — the scent of quiet confidence made tangible. Our most requested fragrance for evenings that demand presence.",
    cardText:
      "A commanding signature of quiet confidence, crafted for presence.",
    image: controlleImg,
    additionalImages: [controlle30],
    thirtyMlImage: controlle30,
    originalPrice: 1800,
    salePrice: 1350,
    size: null,
  },
  {
    id: "falcon-one",
    name: "Falcon One",
    family: "Falcon One",
    category: "falcon-one",
    badge: "Sale",
    description:
      "Bold yet impeccably balanced, Falcon One is built to move through any room with purpose. Sharp, modern and deeply elegant, it rewards the risk-taker who refuses to blend in.",
    cardText: "Bold, balanced and deeply elegant. For the modern risk-taker.",
    image: falconOneImg,
    additionalImages: [falconOne30],
    thirtyMlImage: falconOne30,
    originalPrice: 1500,
    salePrice: 1250,
    size: null,
  },
  {
    id: "masarai",
    name: "Masarai",
    family: "Masarai",
    category: "masarai",
    badge: "Sale",
    description:
      "An artful composition that lingers like a memory. Masarai unfolds in sophisticated layers from the first spray and stays close the whole day through — refined, radiant and unmistakably personal.",
    cardText: "Sophisticated layers that unfold beautifully over time.",
    image: masaraiImg,
    additionalImages: [masarai30],
    thirtyMlImage: masarai30,
    originalPrice: 1800,
    salePrice: 1300,
    size: null,
  },
  {
    id: "meadows",
    name: "Meadows",
    family: "Meadows",
    category: "meadows",
    badge: "Sale",
    description:
      "A serene, radiant scent inspired by open skies and quiet mornings. Soft, warm and effortlessly refined, Meadows is the everyday luxury you reach for without thinking.",
    cardText: "Soft, radiant and effortless. Everyday luxury in a bottle.",
    image: meadowsImg,
    additionalImages: [meadows30],
    thirtyMlImage: meadows30,
    originalPrice: 1800,
    salePrice: 1300,
    size: null,
  },
  {
    id: "luxe-reverie",
    name: "Luxe Reverie",
    family: "Luxe Reverie",
    category: "luxe-reverie",
    badge: "Sale",
    description:
      "An opulent reverie captured in a bottle. Luxe Reverie opens with luminous top notes and unfolds into a rich, velvety heart — a fragrance that whispers of midnight gardens and gilded dreams. For those who wear luxury like a second skin.",
    cardText: "Opulent, velvety and luminous. Luxury worn like a second skin.",
    image: luxeReverieImg,
    additionalImages: [luxeReverie30],
    thirtyMlImage: luxeReverie30,
    originalPrice: 1800,
    salePrice: 1300,
    size: null,
  },
];

export const testers = [
  {
    id: "tester-controlle",
    name: "Controlle",
    description:
      "Experience Controlle before committing to the full bottle — the same fragrance, presented in simple packaging.",
    image: controlleTesterImg,
    additionalImages: [],
    originalPrice: null,
    salePrice: 300,
    size: "Tester",
    badge: null,
  },
  {
    id: "tester-falcon-one",
    name: "Falcon One",
    description:
      "Experience Falcon One before committing to the full bottle — the same fragrance, presented in simple packaging.",
    image: falconOneTesterImg,
    additionalImages: [],
    originalPrice: null,
    salePrice: 300,
    size: "Tester",
    badge: null,
  },
  {
    id: "tester-masarai",
    name: "Masarai",
    description:
      "Experience Masarai before committing to the full bottle — the same fragrance, presented in simple packaging.",
    image: masaraiTesterImg,
    additionalImages: [],
    originalPrice: null,
    salePrice: 300,
    size: "Tester",
    badge: null,
  },
  {
    id: "tester-meadows",
    name: "Meadows",
    description:
      "Experience Meadows before committing to the full bottle — the same fragrance, presented in simple packaging.",
    image: meadowsTesterImg,
    additionalImages: [],
    originalPrice: null,
    salePrice: 300,
    size: "Tester",
    badge: null,
  },
  {
    id: "tester-luxe-reverie",
    name: "Luxe Reverie",
    description:
      "An exclusive sampler from the maison — experience Luxe Reverie before committing to the full bottle.",
    image: luxeReverieTesterImg,
    additionalImages: [],
    originalPrice: null,
    salePrice: 300,
    size: "Tester",
    badge: "Exclusive",
  },
];

export const allProducts = [...perfumes, ...testers];

export const filters = [
  { key: "all", label: "All" },
  { key: "controlle", label: "Controlle" },
  { key: "falcon-one", label: "Falcon One" },
  { key: "masarai", label: "Masarai" },
  { key: "meadows", label: "Meadows" },
  { key: "luxe-reverie", label: "Luxe Reverie" },
];

export const byId = (id) => allProducts.find((p) => p.id === id);