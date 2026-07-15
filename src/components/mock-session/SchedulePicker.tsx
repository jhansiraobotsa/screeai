import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Calendar, ArrowRight } from "lucide-react";

interface SchedulePickerProps {
  onStartNow: () => void;
  onSchedule: (scheduledAt: string) => void;
  loading: boolean;
}

export default function SchedulePicker({ onStartNow, onSchedule, loading }: SchedulePickerProps) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const handleSchedule = () => {
    if (!date || !time) return;
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    onSchedule(scheduledAt);
  };

  // Min date/time = now
  const now = new Date();
  const minDate = now.toISOString().split("T")[0];
  const minTime = date === minDate ? now.toTimeString().slice(0, 5) : "00:00";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Ready to go?</h3>
        <p className="text-sm text-muted-foreground">Start your mock interview now or schedule it for later</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          variant="gradient"
          className="h-auto flex-col gap-2 py-6"
          onClick={onStartNow}
          disabled={loading}
        >
          <Play className="h-6 w-6" />
          <span className="font-semibold">Start Now</span>
          <span className="text-xs opacity-75">Begin your mock interview immediately</span>
        </Button>

        <Button
          variant="outline"
          className="h-auto flex-col gap-2 py-6"
          onClick={() => setShowSchedule(!showSchedule)}
          disabled={loading}
        >
          <Calendar className="h-6 w-6" />
          <span className="font-semibold">Schedule for Later</span>
          <span className="text-xs opacity-75">Pick a date and time</span>
        </Button>
      </div>

      {showSchedule && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-date">Date</Label>
              <Input
                id="schedule-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                min={minDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-time">Time</Label>
              <Input
                id="schedule-time"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                min={minTime}
              />
            </div>
          </div>
          <Button
            onClick={handleSchedule}
            disabled={!date || !time || loading}
            className="w-full"
          >
            Schedule Interview
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
