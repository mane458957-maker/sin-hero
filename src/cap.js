/* Dimensions de la languette (reprises de la casquette) et catalogue des coloris */
export const RX = 0.9
export const RZ = 1.03
export const STRAP_Y = 0.075
export const STRAP_H = 0.17
export const STRAP_A = (53 * Math.PI) / 180
export const STRAP_R = 0.988

/* teintes mesurées sur les photos produit, liens et noms repris de la boutique */
const shop = 'https://sinredparis.com/products/'
export const COLORS = [
  { id: 'blue', name: 'Blue', title: 'SIN RED BLUE ONE', hex: '#33445d', href: shop + 'sin-red-blue' },
  { id: 'black', name: 'Black', title: 'SIN RED BLACK ONE', hex: '#24242c', href: shop + 'sin-red-black-one' },
  { id: 'white', name: 'White', title: 'SIN RED WHITE ONE', hex: '#f1f1f9', href: shop + 'sin-red-white-one-1' },
  { id: 'grey', name: 'Grey', title: 'SIN RED GREY ONE', hex: '#d4d3d8', href: shop + 'sin-red-grey-two' },
  { id: 'red', name: 'Red', title: 'SIN RED ONE', hex: '#f42c3e', href: shop + 'sin-red-one-1' },
  { id: 'bordeaux', name: 'Bordeaux Red', title: 'SIN RED BORDEAUX RED ONE', hex: '#a72749', href: shop + 'sin-red-one' },
  { id: 'green', name: 'Green', title: 'SIN RED GREEN', hex: '#1f6b5c', href: shop + 'sin-red-green' },
  { id: 'brown', name: 'Brown', title: 'SIN RED BROWN', hex: '#9c664f', href: shop + 'sin-red-gold' },
  { id: 'orange', name: 'Orange', title: 'SIN RED ORANGE ONE', hex: '#fdae49', href: shop + 'sin-red-yellow-two' },
  { id: 'nude', name: 'Nude Rose', title: 'SIN RED NUDE ROSE ONE', hex: '#f58e99', href: shop + 'sin-red-pink-one' },
  { id: 'pink', name: 'Pink', title: 'SIN RED PINK ONE', hex: '#fcaecf', href: shop + 'sin-red-pink-two' },
]
