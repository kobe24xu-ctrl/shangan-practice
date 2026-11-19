/* Original English practice sentences created for CEO English Lab.
   These are NOT quotations or transcripts of the linked YouTube videos.
   Speech is generated locally by the browser's speech synthesis voice. */
const sentence=(en,zh,tip)=>({en,zh,tip});
export const WARMUPS={
  'huberman-protocols':[
    sentence('A consistent morning routine can make healthy habits easier to maintain.','规律的晨间安排能够让健康习惯更容易坚持。','can make + 宾语 + 形容词：解释潜在好处而非保证结果'),
    sentence('Light exposure may influence the way our biological clock responds to the day.','接触光线可能影响生物钟对一天的反应。','may influence：谨慎表达科学推测'),
    sentence('It is important to distinguish a promising finding from a proven recommendation.','区分有前景的发现和已证实的建议十分重要。','distinguish A from B：学术对比'),
    sentence('Rather than changing everything at once, start with one manageable habit.','与其一次改变一切，不如从一个可操作的习惯开始。','Rather than ...：提出替代策略')],
  'brain-taylor':[
    sentence('The human brain processes information through several interconnected systems.','人脑通过若干相互连接的系统处理信息。','interconnected systems：解释复杂系统'),
    sentence('A useful analogy can turn an abstract idea into something easier to understand.','贴切的类比能让抽象概念变得容易理解。','turn A into B：呈现变化'),
    sentence('Our perception of an event is not always identical to the event itself.','我们对事件的感知并不总等同于事件本身。','not always identical to：限定说法'),
    sentence('To put it simply, different processes can work together at the same time.','简单来说，不同过程可以同时协同运作。','To put it simply：解释技术概念')],
  'gut-basics':[
    sentence('The microbiome refers to a complex community of microorganisms.','微生物组指一个复杂的微生物群落。','refers to：下定义'),
    sentence('Researchers are still investigating how these systems interact.','研究人员仍在调查这些系统如何相互作用。','are still investigating：表达未有定论'),
    sentence('An association between two factors does not necessarily establish causation.','两个因素相关并不必然能证明因果关系。','does not necessarily：避免过度推断'),
    sentence('The most reliable conclusions usually depend on multiple sources of evidence.','最可靠的结论通常需要多种证据来源。','depend on：解释论证依据')],
  'gut-inflammation':[
    sentence('Inflammation can be part of a normal protective response.','炎症可以是正常保护性反应的一部分。','can be part of：非绝对说明'),
    sentence('The effects may vary depending on the circumstances and the individual.','影响可能因具体情况及个体而异。','vary depending on：讨论差异'),
    sentence('We should be cautious about drawing conclusions from a single study.','仅凭一项研究得出结论应当谨慎。','be cautious about doing：审慎评价'),
    sentence('Several underlying factors may contribute to the same outcome.','多个潜在因素可能共同导致同一结果。','contribute to：多因素因果表达')],
  'perel-relationships':[
    sentence('The way we communicate often reflects our expectations and past experiences.','我们的沟通方式往往反映期望与过去经历。','reflect：从行为推及心理'),
    sentence('Being vulnerable does not mean giving up personal boundaries.','展现脆弱并不意味着放弃个人边界。','does not mean：纠正常见误解'),
    sentence('It can be helpful to describe a feeling before making an accusation.','在指责之前先描述感受可能更有帮助。','It can be helpful to：给出温和建议'),
    sentence('A strong relationship requires both trust and a willingness to listen.','稳固关系需要信任与倾听的意愿。','both A and B：平衡论述')],
  'brain-emotions':[
    sentence('A strong emotion can influence our immediate interpretation of a situation.','强烈情绪可能影响我们对情境的即时理解。','influence：描述心理影响'),
    sentence('There is a difference between noticing a feeling and acting on it.','觉察情绪和按情绪行事之间存在区别。','There is a difference between：对比论点'),
    sentence('Self-awareness may create space for a more deliberate response.','自我觉察可能为更审慎的回应创造空间。','create space for：形象且地道的表达'),
    sentence('Resilience is often built through practice rather than instant change.','心理韧性常通过练习而非瞬间改变建立。','rather than：反向强调')],
  'kaufman-startup':[
    sentence('A viable business idea starts with a problem that people genuinely want solved.','可行的商业创意始于人们真正希望解决的问题。','start with：定义起点'),
    sentence('Before investing resources, we need to test our assumptions.','投入资源前我们需要检验假设。','test assumptions：商业决策高频搭配'),
    sentence('Customer feedback can reveal needs that the original plan overlooked.','客户反馈可能揭示原计划忽视的需求。','reveal / overlook：解释新发现'),
    sentence('The value proposition should be clear enough to explain in one sentence.','价值主张应清晰到可以用一句话说明。','clear enough to：强调程度')],
  'sinek-purpose':[
    sentence('A shared sense of purpose can help a team navigate uncertainty.','共同的目标感能够帮助团队应对不确定性。','navigate uncertainty：雅思工作话题'),
    sentence('We need to distinguish short-term targets from a long-term vision.','我们需要区分短期目标与长期愿景。','distinguish ... from ...：论述结构'),
    sentence('Accountability works best when expectations are communicated clearly.','当预期表达清楚时，责任机制效果最好。','works best when：分析条件'),
    sentence('Meaningful progress involves more than simply meeting a deadline.','有意义的进展不只是赶上截止日期。','involves more than：深化论点')],
  'hinton-ai':[
    sentence('Artificial intelligence presents opportunities as well as significant risks.','人工智能带来机遇，也带来重大风险。','as well as：平衡表述'),
    sentence('Policymakers need to consider the long-term implications of automation.','政策制定者需要考虑自动化的长期影响。','long-term implications：科技社会高频'),
    sentence('It is difficult to predict how quickly a new technology will develop.','很难预测新技术会以多快速度发展。','It is difficult to predict：不确定性表达'),
    sentence('Effective regulation should reduce harm without preventing useful innovation.','有效监管应减少伤害，同时不阻碍有益创新。','without + doing：讨论权衡')],
  'sinek-ai':[
    sentence('Technology can amplify human abilities without replacing human judgment.','技术可以放大人的能力，而不取代人的判断。','amplify / without：比较科技作用'),
    sentence('The real challenge is to adapt while preserving what makes us human.','真正的挑战是在适应的同时保留人类独特的特质。','The real challenge is to：重新定义问题'),
    sentence('Critical thinking becomes more important when information is abundant.','当信息充裕时，批判性思维变得更为重要。','becomes more important when：条件论述'),
    sentence('We should evaluate both the benefits and the unintended consequences.','我们应同时评估收益及意料之外的后果。','unintended consequences：学术讨论常用搭配')]
};