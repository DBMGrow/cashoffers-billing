export interface Product {
  productID: number | string
  title: string
  listName: string
  description: string
  price: number
  whitelabel?: string[]
  hidden?: boolean
  signup?: boolean
}
