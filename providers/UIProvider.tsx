"use client"

import { NextUIProvider } from "@nextui-org/react"
import { FC } from "react"

const UIProvider: FC<any> = (props) => {
  return <NextUIProvider {...props} />
}

export default UIProvider
