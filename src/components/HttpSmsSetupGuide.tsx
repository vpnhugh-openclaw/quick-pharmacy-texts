import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const steps = [
  {
    number: 1,
    heading: 'Create a free httpSMS account',
    body: 'httpSMS is a free service that lets this app send text messages through your Android phone. Go to httpsms.com and sign up, it takes under a minute.',
    actionLabel: 'Go to httpsms.com →',
    href: 'https://httpsms.com/login',
  },
  {
    number: 2,
    heading: 'Install the app on your Android phone',
    body: 'Download and install the HttpSms app on the Android phone you want texts to be sent from. Sign in with the same account you just created. Leave the app running in the background, that is all it needs.',
    actionLabel: 'Download Android app →',
    href: 'https://apk.httpsms.com/HttpSms.apk',
    note: 'Android 5.0 or later required. iPhone is not supported.',
  },
  {
    number: 3,
    heading: 'Copy your API key from httpSMS',
    body: 'In httpSMS, go to Settings and copy your API key. This is the password that lets this app talk to your phone. Keep it private.',
    actionLabel: 'Open httpSMS Settings →',
    href: 'https://httpsms.com/settings',
  },
  {
    number: 4,
    heading: 'Paste your details here',
    body: 'Go to Settings (the gear icon ⚙ at the top of this app), paste your API key, and enter the mobile number of the phone that has the httpSMS app installed. Hit Save, you are done.',
    actionLabel: 'Open Settings ⚙',
  },
] as const;

interface HttpSmsSetupGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}

export default function HttpSmsSetupGuide({ open, onOpenChange, onOpenSettings }: HttpSmsSetupGuideProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#07111f] p-0 text-left shadow-2xl sm:w-full">
        <div className="p-6 sm:p-7">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl text-foreground">Send texts directly from this app</DialogTitle>
            <DialogDescription className="mt-2 text-base text-muted-foreground">
              Takes about 5 minutes. You only do this once.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            {steps.map((step) => (
              <section key={step.number} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d4ed8] text-sm font-semibold text-white">
                    {step.number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-foreground">{step.heading}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
                    {'href' in step && step.href ? (
                      <div className="mt-4">
                        <a
                          href={step.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90"
                        >
                          <span>{step.actionLabel}</span>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        {'note' in step && step.note ? <p className="mt-2 text-xs text-slate-400">{step.note}</p> : null}
                      </div>
                    ) : (
                      <div className="mt-4">
                        <Button type="button" className="rounded-full" onClick={onOpenSettings}>
                          {step.actionLabel}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>

          <div className="mt-6 rounded-3xl bg-[#dbeafe] p-4 text-sm leading-6 text-[#1e3a8a]">
            ✅ Once set up, the 'Send SMS Directly' button will send the message straight to the patient's phone through your Android handset, no copy-pasting, no screen switching, no manual steps.
          </div>

          <DialogFooter className="mt-6 items-start gap-3 border-t border-white/10 pt-5 sm:items-center sm:justify-between sm:space-x-0">
            <Button type="button" variant="outline" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <p className="text-xs text-muted-foreground">Need help? Visit httpsms.com or ask your manager.</p>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
