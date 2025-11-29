import { Contact } from '@/components/website/contact-section'
import { Footer } from '@/components/layouts/footer'
import { Header } from '@/components/layouts/header'
import React from 'react'

const Index = () => {
  return (
    <div >
      <Header />
      <div className="min-h-screen py-24 px-2 md:px-4">
        <Contact />
      </div>
      <Footer />
    </div>
  )
}

export default Index