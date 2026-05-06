use std::cell::RefCell;
use std::future::Future;
use std::pin::Pin;
use std::rc::Rc;
use std::task::{Context, Poll, Waker};
use std::time::Duration;

pub(crate) async fn await_ic_timer(duration: Duration) {
    OneShotTimerFuture::new(duration).await;
}

struct OneShotTimerFuture {
    state: Rc<RefCell<OneShotTimerState>>,
}

struct OneShotTimerState {
    is_complete: bool,
    waker: Option<Waker>,
}

impl OneShotTimerFuture {
    fn new(duration: Duration) -> Self {
        let state = Rc::new(RefCell::new(OneShotTimerState {
            is_complete: false,
            waker: None,
        }));
        let timer_state = Rc::clone(&state);

        ic_cdk_timers::set_timer(duration, async move {
            let waker = {
                let mut state = timer_state.borrow_mut();
                state.is_complete = true;
                state.waker.take()
            };
            if let Some(waker) = waker {
                waker.wake();
            }
        });

        Self { state }
    }
}

impl Future for OneShotTimerFuture {
    type Output = ();

    fn poll(self: Pin<&mut Self>, context: &mut Context<'_>) -> Poll<Self::Output> {
        let mut state = self.state.borrow_mut();
        if state.is_complete {
            return Poll::Ready(());
        }

        state.waker = Some(context.waker().clone());
        Poll::Pending
    }
}
