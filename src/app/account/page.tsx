import { redirect } from 'next/navigation';

// The account section has no index view of its own — its landing tab is
// "My Setups". Bare /account (e.g. the header account icon) lands here.
export default function AccountIndex() {
  redirect('/account/setups');
}
