'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code, Database, Zap, Shield, CheckCircle } from 'lucide-react';

export default function DevToolsPage() {
  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Status</h1>
          <p className="text-muted-foreground">
            Powered by Blink SDK - All backend services integrated
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Blink DB</div>
            <Badge variant="default" className="mt-2">
              <CheckCircle className="h-3 w-3 mr-1" />
              Managed
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Services</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Blink AI</div>
            <Badge variant="default" className="mt-2">
              <CheckCircle className="h-3 w-3 mr-1" />
              Integrated
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Authentication</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Blink Auth</div>
            <Badge variant="default" className="mt-2">
              <CheckCircle className="h-3 w-3 mr-1" />
              Ready
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deployment</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Simple</div>
            <Badge variant="default" className="mt-2">
              <CheckCircle className="h-3 w-3 mr-1" />
              Vercel/Netlify
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ready for Deployment</CardTitle>
          <CardDescription>
            Your application is configured with Blink SDK and ready for simple deployment to Vercel or Netlify
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium">Required Environment Variables:</h4>
              <code className="block mt-2 p-2 bg-muted rounded text-sm">
                NEXT_PUBLIC_BLINK_PROJECT_ID=your_project_id<br/>
                NEXT_PUBLIC_BLINK_CORE_URL=https://api.blinkdotnew.com<br/>
                NEXTAUTH_SECRET=your_secret_key<br/>
                NEXTAUTH_URL=https://your-domain.vercel.app
              </code>
            </div>

            <div>
              <h4 className="font-medium">No Complex Setup Needed:</h4>
              <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                <li>✅ Database managed by Blink</li>
                <li>✅ AI services handled by Blink</li>
                <li>✅ Authentication via Blink</li>
                <li>✅ File storage via Blink</li>
                <li>✅ Real-time via Blink</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}