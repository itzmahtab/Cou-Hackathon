'use client';

import React from 'react';
import { Hero } from '@/components/landing/Hero';
import { About } from '@/components/landing/About';
import { Schedule } from '@/components/landing/Schedule';
import { Events } from '@/components/landing/Events';
import { FAQContact } from '@/components/landing/FAQContact';
import { Sponsors } from '@/components/landing/Sponsors';

export default function LandingPage() {
  return (
    <main className="w-full">
      <Hero />
      <About />
      <Schedule />
      <Events />
      <FAQContact />
      <Sponsors />
    </main>
  );
}
