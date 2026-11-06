/* Dimensions de la languette (reprises de la casquette) et catalogue des coloris */
export const RX = 0.9
export const RZ = 1.03
export const STRAP_Y = 0.075
export const STRAP_H = 0.375
export const STRAP_A = (53 * Math.PI) / 180
export const STRAP_R = 0.988

/* teintes mesurées sur les photos produit, liens et noms repris de la boutique */
const shop = 'https://sinredparis.com/products/'
export const COLORS = [
  { id: 'blue', name: 'Blue', title: 'SIN RED BLUE ONE', hex: '#33445d', glow: '#7e8ba2', deep: '#303e57', href: shop + 'sin-red-blue' },
  { id: 'black', name: 'Black', title: 'SIN RED BLACK ONE', hex: '#24242c', glow: '#76767e', deep: '#292931', href: shop + 'sin-red-black-one' },
  { id: 'white', name: 'White', title: 'SIN RED WHITE ONE', hex: '#f1f1f9', glow: '#f5f5fb', deep: '#b6b6c4', href: shop + 'sin-red-white-one-1' },
  { id: 'grey', name: 'Grey', title: 'SIN RED GREY ONE', hex: '#d4d3d8', glow: '#e1e0e4', deep: '#8d8c96', href: shop + 'sin-red-grey-two' },
  { id: 'red', name: 'Red', title: 'SIN RED ONE', hex: '#f42c3e', glow: '#f76b78', deep: '#c90113', href: shop + 'sin-red-one-1' },
  { id: 'bordeaux', name: 'Bordeaux Red', title: 'SIN RED BORDEAUX RED ONE', hex: '#a72749', glow: '#c16880', deep: '#791731', href: shop + 'sin-red-one' },
  { id: 'green', name: 'Green', title: 'SIN RED GREEN', hex: '#1f6b5c', glow: '#62978d', deep: '#134e42', href: shop + 'sin-red-green' },
  { id: 'brown', name: 'Brown', title: 'SIN RED BROWN', hex: '#9c664f', glow: '#ba9484', deep: '#704635', href: shop + 'sin-red-gold' },
  { id: 'orange', name: 'Orange', title: 'SIN RED ORANGE ONE', hex: '#fdae49', glow: '#fec680', deep: '#e48000', href: shop + 'sin-red-yellow-two' },
  { id: 'nude', name: 'Nude Rose', title: 'SIN RED NUDE ROSE ONE', hex: '#f58e99', glow: '#f8b0b8', deep: '#ea5f70', href: shop + 'sin-red-pink-one' },
  { id: 'pink', name: 'Pink', title: 'SIN RED PINK ONE', hex: '#fcaecf', glow: '#fdc6dd', deep: '#ff3f90', href: shop + 'sin-red-pink-two' },
]
