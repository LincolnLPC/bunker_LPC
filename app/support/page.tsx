"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, HelpCircle, Mail, MessageSquare, BookOpen } from "lucide-react"
import { ContactForm } from "@/components/support/contact-form"

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background" />

      {/* Header */}
      <header className="relative z-10 flex items-center gap-4 px-6 py-4 border-b border-border/50">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Поддержка</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Quick Links */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-card/50 border-border/50 hover:bg-card/70 transition-colors cursor-pointer">
              <Link href="/support/faq">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">FAQ</CardTitle>
                  </div>
                  <CardDescription>
                    Ответы на часто задаваемые вопросы
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            <Card className="bg-card/50 border-border/50 hover:bg-card/70 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Связаться с нами</CardTitle>
                </div>
                <CardDescription>
                  Отправьте нам сообщение через форму
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/50 border-border/50 hover:bg-card/70 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Документация</CardTitle>
                </div>
                <CardDescription>
                  Инструкции и руководства (в разработке)
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Contact Form Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">Форма обратной связи</h2>
              <p className="text-muted-foreground">
                Не нашли ответ на свой вопрос в FAQ? Заполните форму ниже, и мы свяжемся с вами.
              </p>
            </div>
            <ContactForm />
          </div>

          {/* Additional Information */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Другие способы связи</CardTitle>
              <CardDescription>
                Мы всегда готовы помочь вам с любыми вопросами.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Email поддержки</p>
                  <p className="text-sm text-muted-foreground">
                    support@bunker-online.ru (в разработке)
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Время ответа:</strong> Мы стараемся отвечать на все обращения в течение
                  24 часов в рабочие дни. Премиум пользователи получают приоритетную поддержку.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* FAQ Link */}
          <Card className="bg-primary/10 border-primary/50">
            <CardHeader>
              <CardTitle>Сначала проверьте FAQ</CardTitle>
              <CardDescription>
                Возможно, ответ на ваш вопрос уже есть в нашей базе знаний.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/support/faq">
                <Button variant="default" className="w-full sm:w-auto">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Открыть FAQ
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
