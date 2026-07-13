import { ArrowRight, CircleAlert, Gauge, Route } from "lucide-react";

interface HomeScreenProps {
  onStart: () => void;
  calibrationCount: number;
}

export function HomeScreen({ onStart, calibrationCount }: HomeScreenProps) {
  return (
    <div className="screenStack homeScreen">
      <div className="homeSignal" aria-hidden="true">
        <span className="homeSignalLight red" />
        <span className="homeSignalLight yellow" />
        <span className="homeSignalLight green" />
        <span className="homeSignalLight blue" />
      </div>

      <div className="homeLead">
        <p className="microLabel">创业节奏校准器</p>
        <h3>别盲目冲，也别一直想。</h3>
        <p>每一轮都根据新的用户行为、投入和结果，决定现在该踩刹车、做路测，还是立即走向用户。</p>
        <button className="primaryButton homeStart" onClick={onStart}>
          开始检查项目状态
          <ArrowRight size={17} />
        </button>
      </div>

      <div className="twoLaneGrid">
        <article>
          <CircleAlert size={22} />
          <span>投入跑太快</span>
          <strong>没证据就开发、外包、投钱</strong>
          <p>红灯限制投入，黄灯只允许低成本路测。</p>
        </article>
        <article>
          <Route size={22} />
          <span>行动落在后面</span>
          <strong>Demo 做好了，却迟迟不见用户</strong>
          <p>蓝灯要求立即发布、访谈、试用或报价。</p>
        </article>
      </div>

      <div className="homeRule">
        <Gauge size={18} />
        <span>好计划可以获得路测资格，但不能冒充已经发生的证据。{calibrationCount > 0 ? `已保存 ${calibrationCount} 轮校准。` : ""}</span>
      </div>
    </div>
  );
}
