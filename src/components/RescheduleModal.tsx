// @ts-nocheck
import { decimalToTimeString } from '../utils';

export default function RescheduleModal({
  reschedulePrompt,
  setReschedulePrompt,
  applyTaskMove
}) {
  if (!reschedulePrompt) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onMouseDown={() => setReschedulePrompt(null)}>
      <div className="bg-white max-w-md w-full rounded-lg shadow-2xl p-6 border border-gray-300 flex flex-col gap-4 animate-fade-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="border-b pb-2">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Recurring Task Reschedule</span>
          <h3 className="text-xl font-serif font-bold text-gray-900 mt-0.5">{reschedulePrompt.task.title}</h3>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          You are moving a recurring task to <strong>{reschedulePrompt.targetDate}</strong>
          {reschedulePrompt.targetHour !== null && ` at ${decimalToTimeString(reschedulePrompt.targetHour)}`}. How would you like to apply this change?
        </p>

        <div className="flex flex-col gap-2 mt-2">
          <button 
            onClick={() => applyTaskMove(reschedulePrompt.task.id, reschedulePrompt.targetDate, reschedulePrompt.targetHour, reschedulePrompt.targetMemberName, false, reschedulePrompt.sourceDate, reschedulePrompt.isAllDayDrop)}
            className="bg-[#A9B1A6] text-white py-2.5 px-4 rounded text-xs font-bold hover:bg-gray-600 transition text-left flex justify-between items-center">
            <span>Only This Occurrence</span>
            <span className="text-[10px] opacity-80">(Creates standalone task)</span>
          </button>

          <button 
            onClick={() => applyTaskMove(reschedulePrompt.task.id, reschedulePrompt.targetDate, reschedulePrompt.targetHour, reschedulePrompt.targetMemberName, true, reschedulePrompt.sourceDate, reschedulePrompt.isAllDayDrop)}
            className="bg-[#333333] text-white py-2.5 px-4 rounded text-xs font-bold hover:bg-black transition text-left flex justify-between items-center">
            <span>Entire Series / Future Tasks</span>
            <span className="text-[10px] opacity-80">(Updates master rule)</span>
          </button>
        </div>

        <div className="pt-2 border-t flex justify-end">
          <button onClick={() => setReschedulePrompt(null)} className="text-xs text-gray-500 font-bold hover:underline">Cancel Move</button>
        </div>
      </div>
    </div>
  );
}